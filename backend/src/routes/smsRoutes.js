import express from 'express';
import { smsService } from '../services/smsService.js';
import { db } from '../services/db.js';

const router = express.Router();

/**
 * GET /api/sms/status
 * Check SMSLocal gateway configuration and operational health
 */
router.get('/status', async (req, res) => {
  try {
    const config = smsService.getConfig();
    const logs = smsService.getLogs();
    res.json({
      success: true,
      config,
      totalDispatched: logs.length,
      carrierDelivered: logs.filter(l => l.status === 'SENT_TO_CARRIER').length,
      simulated: logs.filter(l => l.status === 'SIMULATED_LOCAL').length,
      failed: logs.filter(l => l.status === 'FAILED_CARRIER' || l.status === 'ERROR').length,
      recentLogs: logs.slice(0, 15)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve SMSLocal gateway status', details: error.message });
  }
});

/**
 * POST /api/sms/config
 * Update SMSLocal credentials dynamically at runtime (server-side only)
 */
router.post('/config', async (req, res) => {
  try {
    const { apiKey, senderId, templateId, messageTemplate } = req.body;
    const updated = smsService.updateConfig({ apiKey, senderId, templateId, messageTemplate });
    res.json({
      success: true,
      message: updated.isConfigured 
        ? 'SMSLocal DLT Gateway active! Real cellular SMS will be delivered to Indian mobile phones on verified SOS.' 
        : 'SMSLocal Gateway in Simulation Mode. Provide SMSLOCAL_API_KEY, SMSLOCAL_SENDER_ID, and SMSLOCAL_TEMPLATE_ID for physical carrier SMS delivery.',
      config: updated
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update SMSLocal configuration', details: error.message });
  }
});

/**
 * GET /api/sms/logs
 * Retrieve audit trail of all outbound emergency SMS dispatches
 */
router.get('/logs', async (req, res) => {
  try {
    const logs = smsService.getLogs();
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve SMS logs', details: error.message });
  }
});

/**
 * POST /api/test/emergency-sms & POST /api/sms/test
 * Test endpoint using the exact same SMSLocal pipeline as real emergencies
 * Accepts: { userId, phone, latitude, longitude, location }
 */
export async function handleTestEmergencySMS(req, res) {
  try {
    const { userId, phone, latitude, longitude, location, recipientName } = req.body;

    let targetPhone = phone;
    let targetUserId = userId || 'GB1024';

    if (!targetPhone && targetUserId) {
      const user = await db.getUserById(targetUserId);
      if (user?.emergencyContact?.phone) {
        targetPhone = user.emergencyContact.phone;
      }
    }

    if (!targetPhone) {
      return res.status(400).json({
        error: 'Target Indian mobile number is required. Please provide "phone" (10 digits) in the request body.'
      });
    }

    const logEntry = await smsService.sendTestEmergencySMS({
      userId: targetUserId,
      phone: targetPhone,
      latitude,
      longitude,
      location: location || 'Coimbatore'
    });

    res.json({
      success: logEntry.status === 'SENT_TO_CARRIER' || logEntry.status === 'SIMULATED_LOCAL',
      message: logEntry.status === 'SENT_TO_CARRIER'
        ? `SMSLocal successfully accepted dispatch to ${logEntry.to}! Message ID: ${logEntry.messageId || 'Accepted'}`
        : `SMS simulated for ${logEntry.to}. To deliver real SMS, configure SMSLOCAL_API_KEY, SMSLOCAL_SENDER_ID, and SMSLOCAL_TEMPLATE_ID.`,
      result: logEntry
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send test emergency SMS', details: error.message });
  }
}

router.post('/test', handleTestEmergencySMS);

export default router;
