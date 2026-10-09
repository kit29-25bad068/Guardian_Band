import express from 'express';
import { db } from '../services/db.js';

const router = express.Router();

/**
 * GET /api/stats
 * Real-time operational metrics for Central Dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/devices
 * List all registered GuardianBand devices with health telemetry
 */
router.get('/devices', async (req, res) => {
  try {
    const devices = await db.getDevices();
    res.json({ success: true, count: devices.length, devices });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

/**
 * GET /api/audit-logs
 * Security and emergency dispatch audit log
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await db.getAuditLogs();
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
