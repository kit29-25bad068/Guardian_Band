import { db } from './db.js';
import { socketService } from './socketService.js';

/**
 * SMSLocal Error Code Mapping according to Indian Telecom DLT guidelines
 */
const SMSLOCAL_ERROR_CODES = {
  '101': 'Invalid API key',
  '102': 'Invalid sender ID',
  '103': 'Invalid recipient number (must be a valid 10-digit Indian mobile number)',
  '104': 'Invalid route (must be Route 1 for transactional emergency alerts)',
  '105': 'Invalid message content or encoding',
  '108': 'Low credits in SMSLocal account',
  '110': 'Invalid DLT template ID or content does not match approved template'
};

class SMSService {
  constructor() {
    this.config = {
      apiKey: process.env.SMSLOCAL_API_KEY || '',
      senderId: process.env.SMSLOCAL_SENDER_ID || '',
      templateId: process.env.SMSLOCAL_TEMPLATE_ID || '',
      route: '1', // Route 1: Transactional / Service Emergency Alert
      messageTemplate: process.env.SMSLOCAL_MESSAGE_TEMPLATE || 
        'GUARDIANBAND ALERT:\nSOS has been verified for User {userId}.\nLocation: {location}\nTime: {time}\nCoordinates: {coordinates}\nMap: {mapUrl}\nPlease respond immediately.'
    };

    this.smsLogs = [];
    console.log('[SMSService] Initialized SMSLocal Service. Status:', this.isConfigured() ? 'CONFIGURED (Live SMSLocal API)' : 'UNCONFIGURED (Simulation Mode)');
  }

  /**
   * Returns true only if all required SMSLocal parameters are present
   */
  isConfigured() {
    return Boolean(this.config.apiKey && this.config.senderId && this.config.templateId);
  }

  /**
   * Returns sanitized public configuration metadata (API key is strictly masked)
   */
  getConfig() {
    return {
      isConfigured: this.isConfigured(),
      provider: 'SMSLOCAL',
      apiKeyMasked: this.config.apiKey 
        ? `${this.config.apiKey.slice(0, 4)}••••••••${this.config.apiKey.slice(-3)}`
        : null,
      senderId: this.config.senderId || null,
      templateId: this.config.templateId || null,
      route: this.config.route,
      messageTemplate: this.config.messageTemplate
    };
  }

  /**
   * Updates runtime configuration (never exposes secrets to client side)
   */
  updateConfig({ apiKey, senderId, templateId, messageTemplate }) {
    if (apiKey !== undefined) this.config.apiKey = apiKey.trim();
    if (senderId !== undefined) this.config.senderId = senderId.trim();
    if (templateId !== undefined) this.config.templateId = templateId.trim();
    if (messageTemplate !== undefined && messageTemplate.trim()) {
      this.config.messageTemplate = messageTemplate.trim();
    }

    console.log('[SMSService] SMSLocal credentials updated. Live Gateway Active:', this.isConfigured());
    return this.getConfig();
  }

  /**
   * Sanitizes phone number into the pure 10-digit Indian mobile format expected by SMSLocal
   * (Removes +91, leading 0, spaces, dashes, or brackets)
   * Example: "+91 98765-43210" -> "9876543210"
   */
  formatIndianMobile(rawPhone) {
    if (!rawPhone) return null;
    let clean = String(rawPhone).trim().replace(/\D/g, '');

    // Strip leading 91 (country code) if length is 12
    if (clean.length === 12 && clean.startsWith('91')) {
      clean = clean.slice(2);
    }
    // Strip leading 0 if length is 11
    if (clean.length === 11 && clean.startsWith('0')) {
      clean = clean.slice(1);
    }

    return clean;
  }

  /**
   * Validates if the sanitized number is a valid 10-digit Indian mobile number
   */
  isValidIndianMobile(tenDigitNumber) {
    return /^[6-9]\d{9}$/.test(tenDigitNumber);
  }

  /**
   * Dynamically constructs the emergency message based on event details and approved DLT template
   */
  buildEmergencyMessage({ userId, location, coordinates, time, mapUrl }) {
    const defaultTemplate = this.config.messageTemplate;
    return defaultTemplate
      .replace(/{userId}/g, userId || 'Wearer')
      .replace(/{location}/g, location || 'Current Location')
      .replace(/{time}/g, time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
      .replace(/{coordinates}/g, coordinates || 'Unavailable')
      .replace(/{mapUrl}/g, mapUrl || 'Unavailable');
  }

  /**
   * Dispatches an SMS using the SMSLocal HTTP GET API
   * Endpoint: https://app.smslocal.in/api/smsapi
   */
  async sendSMS({ to, body, recipientName = 'Guardian', recipientRelation = 'Emergency Contact', emergencyId = null }) {
    const formattedNumber = this.formatIndianMobile(to);
    const now = new Date().toISOString();
    const smsId = `SMS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const logEntry = {
      id: smsId,
      emergencyId,
      timestamp: now,
      rawTo: to,
      to: formattedNumber ? `+91${formattedNumber}` : to,
      sanitizedNumber: formattedNumber,
      recipientName,
      recipientRelation,
      message: body,
      isLiveCarrier: false,
      status: 'PENDING',
      carrierResponse: null,
      messageId: null,
      error: null
    };

    // Validate phone number format
    if (!formattedNumber || !this.isValidIndianMobile(formattedNumber)) {
      logEntry.status = 'FAILED_CARRIER';
      logEntry.error = `Invalid Indian mobile number: "${to}". SMSLocal requires a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.`;
      
      this.smsLogs.unshift(logEntry);
      if (this.smsLogs.length > 200) this.smsLogs.pop();
      socketService.broadcastSMSDispatched(logEntry);
      
      await db.addAuditLog({
        eventType: 'SMS_REJECTED_INVALID_NUMBER',
        severity: 'HIGH',
        details: `Outbound SMS to ${recipientName} failed: ${logEntry.error}`,
        emergencyId
      });
      return logEntry;
    }

    if (this.isConfigured()) {
      try {
        console.log(`[SMSService] 📡 Transmitting real DLT SMS to ${formattedNumber} via SMSLocal HTTP API...`);

        // Construct SMSLocal HTTP GET query params
        const queryParams = new URLSearchParams({
          key: this.config.apiKey,
          route: this.config.route,
          sender: this.config.senderId,
          number: formattedNumber,
          sms: body,
          templateid: this.config.templateId
        });

        const endpoint = `https://app.smslocal.in/api/smsapi?${queryParams.toString()}`;

        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': 'text/plain, application/json, */*'
          }
        });

        const rawResponseText = await response.text();
        const trimmedResponse = rawResponseText.trim();

        // Check if response contains a known SMSLocal error code (101, 102, 103, 104, 105, 108, 110)
        let matchedErrorCode = null;
        for (const code of Object.keys(SMSLOCAL_ERROR_CODES)) {
          if (trimmedResponse === code || trimmedResponse.startsWith(`Error: ${code}`) || trimmedResponse.includes(`"error": "${code}"`) || trimmedResponse.includes(`code: ${code}`)) {
            matchedErrorCode = code;
            break;
          }
        }

        if (matchedErrorCode) {
          const humanError = SMSLOCAL_ERROR_CODES[matchedErrorCode];
          logEntry.isLiveCarrier = true;
          logEntry.status = 'FAILED_CARRIER';
          logEntry.error = `SMSLocal Error [${matchedErrorCode}]: ${humanError}`;
          logEntry.carrierResponse = { raw: trimmedResponse, errorCode: matchedErrorCode };
          console.error(`[SMSService] ❌ SMSLocal rejected dispatch: Code ${matchedErrorCode} - ${humanError}`);
        } else if (!response.ok) {
          logEntry.isLiveCarrier = true;
          logEntry.status = 'FAILED_CARRIER';
          logEntry.error = `SMSLocal HTTP ${response.status}: ${trimmedResponse}`;
          logEntry.carrierResponse = { raw: trimmedResponse, httpStatus: response.status };
          console.error(`[SMSService] ❌ SMSLocal HTTP error:`, trimmedResponse);
        } else {
          // Success: Extract message ID from response (e.g. "Message ID : 123456789" or "123456789")
          let messageId = trimmedResponse;
          const matchMsgId = trimmedResponse.match(/(?:Message\s*ID\s*:\s*|ID\s*:\s*|^)([a-zA-Z0-9_\-]+)/i);
          if (matchMsgId && matchMsgId[1]) {
            messageId = matchMsgId[1];
          }

          logEntry.isLiveCarrier = true;
          logEntry.status = 'SENT_TO_CARRIER';
          logEntry.messageId = messageId;
          logEntry.carrierResponse = { raw: trimmedResponse, messageId };
          console.log(`[SMSService] ✅ SMS Delivered to SMSLocal Carrier Queue! Message ID: ${messageId}`);
        }
      } catch (err) {
        logEntry.status = 'ERROR';
        logEntry.error = `Network error contacting SMSLocal gateway: ${err.message}`;
        console.error('[SMSService] Network error reaching SMSLocal:', err);
      }
    } else {
      // Simulation mode when SMSLOCAL credentials are not yet set
      logEntry.status = 'SIMULATED_LOCAL';
      logEntry.error = 'SMSLocal gateway credentials not configured. Real carrier dispatch requires SMSLOCAL_API_KEY, SMSLOCAL_SENDER_ID, and SMSLOCAL_TEMPLATE_ID.';
      console.log(`[SMSService] ⚠️ SMS Simulated for ${formattedNumber} (SMSLocal credentials not set in backend).`);
    }

    // Record in memory queue
    this.smsLogs.unshift(logEntry);
    if (this.smsLogs.length > 200) this.smsLogs.pop();

    // Broadcast live update over Socket.IO bus
    socketService.broadcastSMSDispatched(logEntry);

    // Record in persistent audit log
    await db.addAuditLog({
      eventType: logEntry.status === 'SENT_TO_CARRIER' ? 'SMSLOCAL_CARRIER_DISPATCHED' : 'SMSLOCAL_SIMULATED_DISPATCHED',
      severity: logEntry.status === 'FAILED_CARRIER' ? 'HIGH' : 'MEDIUM',
      details: `SMSLocal Outbound to ${recipientName} (${logEntry.to}): [${logEntry.status}] ${logEntry.messageId ? `Message ID: ${logEntry.messageId}` : (logEntry.error || 'Dispatched')}`,
      emergencyId
    });

    return logEntry;
  }

  /**
   * Dispatches emergency alert SMS to both primary and secondary emergency contacts upon verified SOS
   */
  async sendSOSAlert({ emergency, user, device }) {
    if (!user) return { dispatched: 0, results: [] };

    const effectiveUserId = user.userId || device?.userId || 'Wearer';
    const timeStr = new Date(emergency.verificationTime || emergency.triggerTime || Date.now())
      .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    let lat = emergency.latitude ?? device?.latitude ?? null;
    let lng = emergency.longitude ?? device?.longitude ?? null;
    let coordsStr = (lat !== null && lng !== null) ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : 'Coordinates Unavailable';
    let mapUrl = (lat !== null && lng !== null) ? `https://maps.google.com/?q=${lat},${lng}` : 'Location Pin Unavailable';
    let locationStr = emergency.address || device?.address || 'Current Sector';

    // Generate dynamic message strictly compliant with DLT variables
    const message = this.buildEmergencyMessage({
      userId: effectiveUserId,
      location: locationStr,
      coordinates: coordsStr,
      time: timeStr,
      mapUrl
    });

    const recipients = [];
    if (user.emergencyContact && user.emergencyContact.phone) {
      recipients.push({
        name: user.emergencyContact.name || 'Primary Guardian',
        relation: user.emergencyContact.relation || 'Guardian',
        phone: user.emergencyContact.phone
      });
    }

    if (user.secondaryContact && user.secondaryContact.phone) {
      recipients.push({
        name: user.secondaryContact.name || 'Secondary Contact',
        relation: user.secondaryContact.relation || 'Friend',
        phone: user.secondaryContact.phone
      });
    }

    const results = [];
    for (const r of recipients) {
      const res = await this.sendSMS({
        to: r.phone,
        body: message,
        recipientName: r.name,
        recipientRelation: r.relation,
        emergencyId: emergency.emergencyId
      });
      results.push(res);
    }

    return {
      dispatched: results.length,
      isLiveCarrier: this.isConfigured(),
      provider: 'SMSLOCAL',
      results
    };
  }

  /**
   * Test emergency SMS method (shares the exact same SMSLocal pipeline as real emergencies)
   */
  async sendTestEmergencySMS({ userId = 'GB1024', phone, latitude, longitude, location = 'Coimbatore' }) {
    const lat = latitude ?? 11.0168;
    const lng = longitude ?? 76.9558;
    const coordsStr = `${lat}, ${lng}`;
    const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const message = this.buildEmergencyMessage({
      userId,
      location,
      coordinates: coordsStr,
      time: timeStr,
      mapUrl
    });

    return await this.sendSMS({
      to: phone,
      body: message,
      recipientName: 'Test Recipient',
      recipientRelation: 'Test Mode',
      emergencyId: 'TEST-EMG'
    });
  }

  getLogs() {
    return this.smsLogs;
  }
}

export const smsService = new SMSService();
