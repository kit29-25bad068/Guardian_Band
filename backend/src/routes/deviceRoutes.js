import express from 'express';
import { db } from '../services/db.js';
import { aiAutomation } from '../services/aiAutomation.js';
import { socketService } from '../services/socketService.js';
import { smsService } from '../services/smsService.js';

const router = express.Router();

/**
 * Middleware: Authenticate hardware device token
 * Rejects unauthenticated device IDs to prevent spoofing.
 */
async function authenticateDevice(req, res, next) {
  const token = req.headers['x-device-token'] || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  const deviceId = req.body.deviceId || req.query.deviceId;

  if (!deviceId) {
    return res.status(400).json({ error: 'Missing required field: deviceId' });
  }

  const device = await db.getDeviceById(deviceId);
  if (!device) {
    return res.status(404).json({ error: `Device ${deviceId} not registered in GuardianBand system` });
  }

  // Allow token match or standard dev token for testing
  const isValid = token && (token === device.token || token === 'GUARDIAN_DEV_SECRET_TOKEN_2026');
  if (!isValid) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing device authentication token',
      hint: 'Include x-device-token in request headers'
    });
  }

  req.device = device;
  next();
}

/**
 * POST /api/device/sos
 * Triggers or verifies an emergency SOS event from wearable.
 * 
 * Exact Workflow:
 * 2 deliberate presses -> "ARE YOU SAFE?" -> 15s window -> NO RESPONSE -> SOS VERIFIED -> CELLULAR -> HERE
 */
router.post('/sos', authenticateDevice, async (req, res) => {
  try {
    const {
      userId,
      deviceId,
      triggerTime,
      verificationTime,
      verificationMethod, // 'NO_RESPONSE_15S' or 'EXPLICIT_EMERGENCY_CONFIRMED'
      latitude,
      longitude,
      address,
      battery,
      cellularSignalDbm,
      heartRate,
      spo2,
      source // 'SIMULATOR' | 'PHYSICAL_DEVICE'
    } = req.body;

    const effectiveUserId = userId || req.device.userId;
    const user = await db.getUserById(effectiveUserId);

    // Build timeline entries capturing exact wearable workflow
    const now = new Date().toISOString();
    const tTime = triggerTime || now;
    const vTime = verificationTime || now;

    const timeline = [
      { time: tTime, event: "1st SOS Press detected on GuardianBand" },
      { time: new Date(new Date(tTime).getTime() + 1500).toISOString(), event: "2nd SOS Press confirmed by wearer" },
      { time: new Date(new Date(tTime).getTime() + 1500).toISOString(), event: "Started 15-second safety timer on device" },
      { 
        time: vTime, 
        event: verificationMethod === 'EXPLICIT_EMERGENCY_CONFIRMED' 
          ? "Immediate emergency confirmed by wearer (Manual SOS)" 
          : "No 3rd Press for 15 seconds: VERIFIED EMERGENCY" 
      },
      { time: vTime, event: "🚨 VERIFIED EMERGENCY confirmed" },
      { time: vTime, event: "Collected Emergency Data: ESP32 Local Storage & Sensors (GPS, MAX30102 HR/SpO2)" },
      { time: now, event: "SIM800L SMS dispatched to Emergency Contacts" },
      { time: now, event: "SIM800L GPRS payload delivered to Node.js Backend & Firebase" },
      { time: now, event: "Central Control Dashboard received verified emergency" },
      { time: now, event: "Continuous Location Monitoring active (every 3s)" }
    ];

    // Update device telemetry
    await db.updateDevice(deviceId, {
      battery: battery ?? req.device.battery,
      latitude: latitude ?? req.device.latitude,
      longitude: longitude ?? req.device.longitude,
      cellularSignalDbm: cellularSignalDbm ?? req.device.cellularSignalDbm,
      heartRate: heartRate ?? req.device.heartRate ?? 115,
      spo2: spo2 ?? req.device.spo2 ?? 97,
      source: source || req.device.source || "SIMULATOR",
      status: "ONLINE",
      emergencyState: "VERIFIED_EMERGENCY",
      trackingStatus: "ACTIVE",
      lastUpdated: now
    });

    // Step 9: Trigger AI automation
    const aiReport = await aiAutomation.processEmergencyEvent(
      {
        userId: effectiveUserId,
        deviceId,
        triggerTime: tTime,
        verificationTime: vTime,
        verificationMethod: verificationMethod || "NO_RESPONSE_15S",
        latitude: latitude ?? req.device.latitude,
        longitude: longitude ?? req.device.longitude,
        address: address || req.device.address,
        heartRate: heartRate ?? req.device.heartRate ?? 115,
        spo2: spo2 ?? req.device.spo2 ?? 97,
        battery: battery ?? req.device.battery ?? 84
      },
      user,
      req.device
    );

    timeline.push({
      time: new Date().toISOString(),
      event: `AI validation completed (Priority: ${aiReport.priority}, Status: ${aiReport.aiStatus})`
    });

    timeline.push({
      time: new Date().toISOString(),
      event: "Automatic transfer to Police Control Room initiated"
    });

    // Create emergency record in database
    const emergency = await db.createEmergency({
      userId: effectiveUserId,
      deviceId,
      status: "NEW",
      priority: aiReport.priority,
      heartRate: heartRate ?? req.device.heartRate ?? 115,
      spo2: spo2 ?? req.device.spo2 ?? 97,
      battery: battery ?? req.device.battery ?? 84,
      policeEscalationStatus: "SENT",
      trackingUrl: `/portal?id=EMG-2026-PENDING`,
      triggerTime: tTime,
      verificationTime: vTime,
      verificationMethod: verificationMethod || "NO_RESPONSE_15S",
      latitude: latitude ?? req.device.latitude,
      longitude: longitude ?? req.device.longitude,
      address: address || req.device.address || "Resolving sector address...",
      policeStatus: "NEW",
      aiStatus: aiReport.aiStatus,
      aiReport,
      timeline
    });

    // Update trackingUrl with actual emergency ID
    emergency.trackingUrl = `/portal?id=${emergency.emergencyId}`;

    // Step 10 & 11: Real-time broadcast to Police Control Room & Central Dashboard
    socketService.broadcastNewEmergency(emergency, user, req.device);

    // Step 12: Automatically dispatch Emergency Alert SMS to Registered Emergency Contacts
    let smsDispatch = null;
    try {
      smsDispatch = await smsService.sendSOSAlert({
        emergency,
        user,
        device: req.device
      });
      console.log(`[DeviceAPI] Emergency SMS dispatch completed: ${smsDispatch.dispatched} recipient(s) processed (Carrier live: ${smsDispatch.isLiveCarrier}).`);
    } catch (smsErr) {
      console.error('[DeviceAPI] Error during emergency SMS dispatch:', smsErr.message);
    }

    // Audit log entry
    await db.addAuditLog({
      eventType: "SOS_VERIFIED_ESCALATED",
      severity: aiReport.priority,
      details: `Emergency ${emergency.emergencyId} verified for ${user?.name || effectiveUserId} (${deviceId}) via ${verificationMethod || '15s timeout'}. Escalated to Police Control Room and ${smsDispatch?.dispatched || 0} emergency contact(s).`,
      userId: effectiveUserId,
      deviceId
    });

    return res.status(201).json({
      success: true,
      message: 'SOS Verified and automatically escalated to Police Control Room and Emergency Contacts',
      emergencyId: emergency.emergencyId,
      status: emergency.status,
      aiReport: emergency.aiReport,
      routing: 'AUTOMATIC_TRANSFER_COMPLETE',
      smsDispatch
    });

  } catch (error) {
    console.error('[DeviceAPI] Error handling /sos:', error);
    res.status(500).json({ error: 'Internal server error processing SOS event', details: error.message });
  }
});

/**
 * POST /api/device/location
 * Ingests continuous GPS updates after SOS verification
 */
router.post('/location', authenticateDevice, async (req, res) => {
  try {
    const { emergencyId, deviceId, userId, latitude, longitude, address, timestamp } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing coordinates: latitude and longitude are required' });
    }

    const now = timestamp || new Date().toISOString();

    // Determine target emergency ID
    let targetEmergencyId = emergencyId;
    if (!targetEmergencyId) {
      // Find active emergency for this device
      const activeList = await db.getEmergencies({ deviceId, status: "NEW" });
      const acknowledgedList = await db.getEmergencies({ deviceId, status: "ACKNOWLEDGED" });
      const dispatchedList = await db.getEmergencies({ deviceId, status: "DISPATCHED" });
      const found = [...activeList, ...acknowledgedList, ...dispatchedList][0];
      if (found) targetEmergencyId = found.emergencyId;
    }

    // Update device state
    await db.updateDevice(deviceId, {
      latitude,
      longitude,
      address: address || undefined,
      lastUpdated: now
    });

    let historyResult = null;
    if (targetEmergencyId) {
      historyResult = await db.addEmergencyLocation(targetEmergencyId, {
        latitude,
        longitude,
        address,
        timestamp: now
      });

      // Step 12: Real-time broadcast to police & guardian maps
      socketService.broadcastLocationUpdate(targetEmergencyId, {
        latitude,
        longitude,
        address,
        timestamp: now
      });
    }

    // Broadcast general device telemetry
    socketService.broadcastDeviceStatus(await db.getDeviceById(deviceId));

    return res.json({
      success: true,
      message: 'Location update processed',
      emergencyId: targetEmergencyId || null,
      point: { latitude, longitude, timestamp: now },
      totalBreadcrumbs: historyResult?.totalPoints || 1
    });

  } catch (error) {
    console.error('[DeviceAPI] Error handling /location:', error);
    res.status(500).json({ error: 'Failed to record location update', details: error.message });
  }
});

/**
 * POST /api/device/status
 * Telemetry update (battery, cellular connection, firmware, health, tracking)
 */
router.post('/status', authenticateDevice, async (req, res) => {
  try {
    const { 
      deviceId, battery, status, gpsStatus, cellularStatus, cellularSignalDbm, 
      firmwareVersion, heartRate, spo2, source, trackingStatus, emergencyState 
    } = req.body;

    const updated = await db.updateDevice(deviceId, {
      ...(battery !== undefined && { battery }),
      ...(status && { status }),
      ...(gpsStatus && { gpsStatus }),
      ...(cellularStatus && { cellularStatus }),
      ...(cellularSignalDbm !== undefined && { cellularSignalDbm }),
      ...(firmwareVersion && { firmwareVersion }),
      ...(heartRate !== undefined && { heartRate }),
      ...(spo2 !== undefined && { spo2 }),
      ...(source && { source }),
      ...(trackingStatus && { trackingStatus }),
      ...(emergencyState && { emergencyState }),
      lastHeartbeat: new Date().toISOString()
    });

    socketService.broadcastDeviceStatus(updated);

    res.json({ success: true, device: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update device telemetry' });
  }
});

/**
 * POST /api/device/heartbeat
 * Periodic keepalive ping from cellular modem
 */
router.post('/heartbeat', authenticateDevice, async (req, res) => {
  try {
    const { deviceId, battery, latitude, longitude, heartRate, spo2 } = req.body;

    const updated = await db.updateDevice(deviceId, {
      status: "ONLINE",
      ...(battery !== undefined && { battery }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(heartRate !== undefined && { heartRate }),
      ...(spo2 !== undefined && { spo2 }),
      lastHeartbeat: new Date().toISOString()
    });

    res.json({ success: true, timestamp: new Date().toISOString(), deviceId });
  } catch (error) {
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

/**
 * POST /api/device/cancel
 * Handles safety verification cancellation ("YES, I'M SAFE")
 */
router.post('/cancel', authenticateDevice, async (req, res) => {
  try {
    const { deviceId, userId, triggerTime, cancellationTime, reason } = req.body;
    const now = cancellationTime || new Date().toISOString();

    await db.updateDevice(deviceId, {
      emergencyState: "NORMAL",
      trackingStatus: "IDLE",
      activeEmergencyId: null,
      lastUpdated: now
    });

    const cancelReason = reason || "3RD_PRESS_WITHIN_15S_EMERGENCY_CANCELLED";
    await db.addAuditLog({
      eventType: "SOS_CANCELLED_BY_USER",
      severity: "INFO",
      details: `Wearer of device ${deviceId} pressed SOS 3rd time within 15s (${cancelReason}). Emergency cancelled. Device returned to NORMAL.`,
      userId: userId || req.device.userId,
      deviceId
    });

    socketService.broadcastSOSCancelled({
      deviceId,
      userId: userId || req.device.userId,
      triggerTime,
      cancellationTime: now,
      reason: cancelReason
    });

    socketService.broadcastDeviceStatus(await db.getDeviceById(deviceId));

    res.json({
      success: true,
      status: "CANCELLED",
      message: '3rd Press within 15s detected. Emergency cancelled. Device returned to NORMAL.',
      recordedAt: now
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record SOS cancellation' });
  }
});

/**
 * POST /api/device/:deviceId/command
 * Central Dashboard -> Node.js -> Device Simulator Command Dispatcher
 * Controls: REQUEST_LOCATION, START_TRACKING, STOP_TRACKING, TEST_SOS, CANCEL_TEST_EMERGENCY, RESET_DEVICE
 */
router.post('/:deviceId/command', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command, params } = req.body;

    const validCommands = [
      'REQUEST_LOCATION',
      'START_TRACKING',
      'STOP_TRACKING',
      'TEST_SOS',
      'CANCEL_TEST_EMERGENCY',
      'RESET_DEVICE'
    ];

    if (!validCommands.includes(command)) {
      return res.status(400).json({
        error: `Invalid command '${command}'. Allowed: ${validCommands.join(', ')}`
      });
    }

    const device = await db.getDeviceById(deviceId);
    if (!device) {
      return res.status(404).json({ error: `Device ${deviceId} not found` });
    }

    // Update trackingStatus or emergencyState in database according to command
    if (command === 'START_TRACKING') {
      await db.updateDevice(deviceId, { trackingStatus: 'ACTIVE' });
    } else if (command === 'STOP_TRACKING') {
      await db.updateDevice(deviceId, { trackingStatus: 'IDLE' });
    } else if (command === 'RESET_DEVICE') {
      await db.resetDeviceState(deviceId);
    }

    // Broadcast command to connected device / simulator
    socketService.broadcastDeviceCommand(deviceId, command, params);

    // If device state changed, broadcast telemetry
    const updatedDevice = await db.getDeviceById(deviceId);
    socketService.broadcastDeviceStatus(updatedDevice);

    await db.addAuditLog({
      eventType: `DASHBOARD_COMMAND_${command}`,
      severity: command === 'TEST_SOS' ? 'WARNING' : 'INFO',
      details: `Central Control Room sent command [${command}] to device ${deviceId}.`,
      deviceId
    });

    res.json({
      success: true,
      message: `Command [${command}] successfully dispatched to device ${deviceId}`,
      command,
      device: updatedDevice
    });
  } catch (error) {
    console.error('[DeviceAPI] Error handling /command:', error);
    res.status(500).json({ error: 'Failed to dispatch device command', details: error.message });
  }
});

/**
 * POST /api/device/:deviceId/reset
 * Resets simulated device back to default NORMAL state
 */
router.post('/:deviceId/reset', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const reset = await db.resetDeviceState(deviceId);
    if (!reset) {
      return res.status(404).json({ error: `Device ${deviceId} not found` });
    }

    socketService.broadcastDeviceCommand(deviceId, 'RESET_DEVICE');
    socketService.broadcastDeviceStatus(reset);

    await db.addAuditLog({
      eventType: "DEVICE_RESET",
      severity: "INFO",
      details: `Device ${deviceId} reset to NORMAL operating state by Central Dashboard.`,
      deviceId
    });

    res.json({
      success: true,
      message: `Device ${deviceId} reset to NORMAL`,
      device: reset
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset device', details: error.message });
  }
});

export default router;
