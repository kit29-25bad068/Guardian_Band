import express from 'express';
import { db } from '../services/db.js';

const router = express.Router();

/**
 * GET /api/users
 * Returns list of users for testing/demo switcher
 */
router.get('/', async (req, res) => {
  try {
    const users = await db.getUsers();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/users/:id
 * Retrieve user profile
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: `User ${req.params.id} not found` });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * GET /api/users/:id/device
 * Retrieve registered wearable for user
 */
router.get('/:id/device', async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const device = await db.getDeviceById(user.deviceId);
    res.json({ success: true, device });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user device' });
  }
});

/**
 * GET /api/users/:id/emergencies
 * Retrieve emergency history for this user
 */
router.get('/:id/emergencies', async (req, res) => {
  try {
    const emergencies = await db.getEmergencies({ userId: req.params.id });
    res.json({ success: true, emergencies });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user emergency history' });
  }
});

/**
 * PUT /api/users/:id
 * Update user profile or emergency contacts
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, address, bloodGroup, medicalNotes, emergencyContact, secondaryContact } = req.body;
    const user = await db.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;
    if (bloodGroup !== undefined) updates.bloodGroup = bloodGroup;
    if (medicalNotes !== undefined) updates.medicalNotes = medicalNotes;
    if (emergencyContact !== undefined) updates.emergencyContact = emergencyContact;
    if (secondaryContact !== undefined) updates.secondaryContact = secondaryContact;

    const updated = await db.updateUser(req.params.id, updates);
    res.json({ success: true, user: updated, message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

/**
 * POST /api/users/:id/emergency-contacts
 * Add / update emergency contact specifically
 */
router.post('/:id/emergency-contacts', async (req, res) => {
  try {
    const { name, relation, phone, secondaryContact } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required for emergency contact' });
    }

    const user = await db.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = {
      emergencyContact: {
        name,
        relation: relation || 'Guardian',
        phone
      }
    };

    if (secondaryContact) {
      updates.secondaryContact = secondaryContact;
    }

    const updated = await db.updateUser(req.params.id, updates);
    res.json({ success: true, user: updated, message: 'Emergency contact updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update emergency contact' });
  }
});

export default router;
