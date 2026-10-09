import express from 'express';
import { db } from '../services/db.js';
import { socketService } from '../services/socketService.js';
import { aiAutomation } from '../services/aiAutomation.js';
import { smsService } from '../services/smsService.js';

const router = express.Router();

/**
 * GET /api/emergencies
 * List all emergencies with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const { status, userId, deviceId } = req.query;
    const emergencies = await db.getEmergencies({ status, userId, deviceId });

    // Enrich with user and device details
    const enriched = await Promise.all(emergencies.map(async (emg) => {
      const user = await db.getUserById(emg.userId);
      const device = await db.getDeviceById(emg.deviceId);
      return {
        ...emg,
        user: user ? {
          name: user.name,
          phone: user.phone,
          emergencyContact: user.emergencyContact,
          secondaryContact: user.secondaryContact
        } : null,
        device: device ? {
          battery: device.battery,
          status: device.status,
          firmwareVersion: device.firmwareVersion
        } : null
      };
    }));

    res.json({ success: true, count: enriched.length, emergencies: enriched });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch emergencies', details: error.message });
  }
});

/**
 * GET /api/emergencies/:id
 * Retrieve emergency record with complete timeline and GPS trail
 */
router.get('/:id', async (req, res) => {
  try {
    const emergency = await db.getEmergencyById(req.params.id);
    if (!emergency) {
      return res.status(404).json({ error: `Emergency ${req.params.id} not found` });
    }

    const user = await db.getUserById(emergency.userId);
    const device = await db.getDeviceById(emergency.deviceId);
    const locationHistory = await db.getEmergencyLocations(emergency.emergencyId);

    res.json({
      success: true,
      emergency: {
        ...emergency,
        user,
        device,
        locationHistory
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch emergency details', details: error.message });
  }
});

/**
 * PATCH /api/emergencies/:id/status
 * State transition: NEW -> ACKNOWLEDGED -> DISPATCHED -> RESOLVED
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, operatorId, notes, dispatchedUnit } = req.body;
    const validStatuses = ['NEW', 'ACKNOWLEDGED', 'DISPATCHED', 'RESOLVED', 'CANCELLED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const existing = await db.getEmergencyById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: `Emergency ${req.params.id} not found` });
    }

    const now = new Date().toISOString();
    let statusText = status;
    if (status === 'ACKNOWLEDGED') {
      statusText = `Emergency acknowledged by Operator ${operatorId || '#701'}`;
    } else if (status === 'DISPATCHED') {
      statusText = `Emergency response unit dispatched: ${dispatchedUnit || 'Sector 4 Patrol Car 12'}`;
    } else if (status === 'RESOLVED') {
      statusText = `Emergency incident resolved on scene. ${notes || 'Wearer assisted safely.'}`;
    }

    const updated = await db.updateEmergency(req.params.id, {
      status,
      policeStatus: status,
      ...(dispatchedUnit && { dispatchedUnit }),
      ...(notes && { resolutionNotes: notes }),
      newEvent: statusText
    });

    // If emergency is resolved, return the wearable hardware to NORMAL state
    if (status === 'RESOLVED') {
      try {
        const resetDevice = await db.updateDevice(existing.deviceId, {
          emergencyState: "NORMAL",
          trackingStatus: "IDLE",
          activeEmergencyId: null,
          lastUpdated: now
        });
        socketService.broadcastDeviceCommand(existing.deviceId, 'RESET_DEVICE');
        if (resetDevice) {
          socketService.broadcastDeviceStatus(resetDevice);
        }
      } catch (devErr) {
        console.warn('[EmergencyRoutes] Device reset on resolve warning:', devErr.message);
      }
    }

    // Broadcast status change across all connected dashboards
    socketService.broadcastEmergencyUpdated(updated);

    // Add audit log
    await db.addAuditLog({
      eventType: `EMERGENCY_${status}`,
      severity: status === 'RESOLVED' ? 'INFO' : 'HIGH',
      details: `${req.params.id} status updated to ${status}. ${statusText}`,
      emergencyId: req.params.id,
      userId: existing.userId,
      deviceId: existing.deviceId,
      operatorId: operatorId || 'POLICE_OPERATOR'
    });

    res.json({
      success: true,
      message: `Emergency status updated to ${status}`,
      emergency: updated
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to update emergency status', details: error.message });
  }
});

/**
 * POST /api/emergencies/:id/clear-trail
 * Clears the breadcrumb trail / movement history for an emergency
 */
router.post('/:id/clear-trail', async (req, res) => {
  try {
    const cleared = await db.clearEmergencyLocations(req.params.id);
    const emg = await db.getEmergencyById(req.params.id);

    // Broadcast reset location update
    if (emg && emg.latitude && emg.longitude) {
      socketService.broadcastLocationUpdate(req.params.id, {
        latitude: emg.latitude,
        longitude: emg.longitude,
        address: emg.address,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Trail cleared successfully', locationHistory: cleared });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear trail', details: error.message });
  }
});

/**
 * POST /api/test/emergency
 * DEMO / DEVELOPMENT MODE: Instant test emergency generator
 */
router.post('/test/generate', async (req, res) => {
  try {
    const { userId = "USER-1024", deviceId = "GB-1024", latitude = 10.9994, longitude = 77.0838 } = req.body;
    const user = await db.getUserById(userId);
    const device = await db.getDeviceById(deviceId);

    const now = new Date().toISOString();
    const triggerTime = new Date(Date.now() - 17000).toISOString();
    const verificationTime = new Date(Date.now() - 2000).toISOString();

    const aiReport = await aiAutomation.processEmergencyEvent(
      {
        userId,
        deviceId,
        triggerTime,
        verificationTime,
        verificationMethod: "DEMO_TEST_BUTTON",
        latitude,
        longitude,
        address: "Kalaignar Karunanidhi Institute of Technology, Coimbatore, TN"
      },
      user,
      device
    );

    const emergency = await db.createEmergency({
      userId,
      deviceId,
      status: "NEW",
      priority: "CRITICAL",
      triggerTime,
      verificationTime,
      verificationMethod: "DEMO_SIMULATION_PRESS",
      latitude,
      longitude,
      address: "Kalaignar Karunanidhi Institute of Technology, Coimbatore, TN",
      policeStatus: "NEW",
      aiStatus: aiReport.aiStatus,
      aiReport,
      timeline: [
        { time: triggerTime, event: "[DEMO MODE] SOS trigger button pressed" },
        { time: new Date(new Date(triggerTime).getTime() + 1500).toISOString(), event: "[DEMO MODE] 2nd deliberate press detected" },
        { time: new Date(new Date(triggerTime).getTime() + 1500).toISOString(), event: "[DEMO MODE] \"ARE YOU SAFE?\" 15s countdown" },
        { time: verificationTime, event: "[DEMO MODE] 15s elapsed with no response" },
        { time: verificationTime, event: "🚨 [DEMO MODE] SOS VERIFIED" },
        { time: now, event: "Cellular packet ingested by Central Dashboard" },
        { time: now, event: `AI validation completed (Priority: ${aiReport.priority})` },
        { time: now, event: "Emergency automatically transferred to Police Control Room" }
      ]
    });

    socketService.broadcastNewEmergency(emergency, user, device);

    // Auto-dispatch SMS to wearer's emergency contacts
    let smsDispatch = null;
    try {
      smsDispatch = await smsService.sendSOSAlert({ emergency, user, device });
    } catch (smsErr) {
      console.error('[EmergencyRoutes] Test SMS dispatch error:', smsErr.message);
    }

    await db.addAuditLog({
      eventType: "DEMO_TEST_EMERGENCY_CREATED",
      severity: "WARNING",
      details: `[DEMO / TEST MODE] Simulated emergency ${emergency.emergencyId} injected into system. Dispatched SMS to ${smsDispatch?.dispatched || 0} contact(s).`,
      userId,
      deviceId
    });

    res.status(201).json({
      success: true,
      message: 'Demo test emergency generated and transferred to Police Control Room and Emergency Contacts',
      emergency,
      smsDispatch
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to generate test emergency', details: error.message });
  }
});

export default router;
