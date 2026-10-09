import { seedUsers, seedDevices, seedEmergencies, seedLocationHistory, seedAuditLogs } from '../data/seedData.js';

class DatabaseService {
  constructor() {
    this.users = new Map(seedUsers.map(u => [u.userId, { ...u }]));
    this.devices = new Map(seedDevices.map(d => [d.deviceId, { ...d }]));
    this.emergencies = new Map(seedEmergencies.map(e => [e.emergencyId, { ...e }]));
    this.emergencyEvents = this.emergencies; // Firestore collection alias
    this.locationHistory = new Map(Object.entries(seedLocationHistory).map(([k, v]) => [k, [...v]]));
    this.locations = this.locationHistory; // Firestore collection alias
    this.policeAlerts = new Map([
      ["ALT-2026-001", {
        alertId: "ALT-2026-001",
        eventId: "EMG-2026-001",
        deviceId: "GB-2048",
        userId: "USER-2048",
        status: "DISPATCHED",
        priority: "HIGH",
        latitude: 11.0268,
        longitude: 77.0028,
        heartRate: 112,
        spo2: 96,
        battery: 42,
        trackingUrl: "/portal?id=EMG-2026-001",
        createdAt: new Date(Date.now() - 885000).toISOString()
      }]
    ]);
    this.auditLogs = [...seedAuditLogs];

    console.log('[DatabaseService] Initialized in-memory Firestore-compatible data store (devices, emergencyEvents, locations, policeAlerts).');
  }

  // USERS
  async getUsers() {
    return Array.from(this.users.values());
  }

  async getUserById(userId) {
    return this.users.get(userId) || null;
  }

  async updateUser(userId, updates) {
    const existing = this.users.get(userId);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.users.set(userId, updated);
    return updated;
  }

  // DEVICES
  async getDevices() {
    return Array.from(this.devices.values());
  }

  async getDeviceById(deviceId) {
    return this.devices.get(deviceId) || null;
  }

  async updateDevice(deviceId, updates) {
    const existing = this.devices.get(deviceId);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    this.devices.set(deviceId, updated);
    return updated;
  }

  // EMERGENCIES
  async getEmergencies(filter = {}) {
    let list = Array.from(this.emergencies.values());
    if (filter.status) {
      list = list.filter(e => e.status === filter.status);
    }
    if (filter.userId) {
      list = list.filter(e => e.userId === filter.userId);
    }
    if (filter.deviceId) {
      list = list.filter(e => e.deviceId === filter.deviceId);
    }
    // Sort descending by trigger/creation time
    return list.sort((a, b) => new Date(b.createdAt || b.triggerTime) - new Date(a.createdAt || a.triggerTime));
  }

  async getEmergencyById(emergencyId) {
    const emg = this.emergencies.get(emergencyId);
    if (!emg) return null;
    const history = this.locationHistory.get(emergencyId) || [];
    return { ...emg, locationHistory: history };
  }

  async createEmergency(emergencyData) {
    const emergencyId = emergencyData.emergencyId || `EMG-2026-${String(this.emergencies.size + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const record = {
      emergencyId,
      eventId: emergencyId,
      userId: emergencyData.userId,
      deviceId: emergencyData.deviceId,
      status: emergencyData.status || "NEW",
      priority: emergencyData.priority || "HIGH",
      heartRate: emergencyData.heartRate ?? 110,
      spo2: emergencyData.spo2 ?? 97,
      battery: emergencyData.battery ?? 84,
      policeEscalationStatus: emergencyData.policeEscalationStatus || "SENT",
      trackingUrl: emergencyData.trackingUrl || `/portal?id=${emergencyId}`,
      triggerTime: emergencyData.triggerTime || now,
      verificationTime: emergencyData.verificationTime || now,
      verificationMethod: emergencyData.verificationMethod || "NO_RESPONSE_15S",
      latitude: emergencyData.latitude ?? null,
      longitude: emergencyData.longitude ?? null,
      address: emergencyData.address || "Resolving tactical address...",
      policeStatus: emergencyData.policeStatus || "NEW",
      aiStatus: emergencyData.aiStatus || "COMPLETED",
      aiReport: emergencyData.aiReport || null,
      timeline: emergencyData.timeline || [
        { time: emergencyData.triggerTime || now, event: "SOS trigger (Press 1)" },
        { time: now, event: "Second deliberate press detected" },
        { time: now, event: "\"ARE YOU SAFE?\" 15s window initiated" },
        { time: now, event: "No response within 15 seconds" },
        { time: now, event: "🚨 SOS VERIFIED" },
        { time: now, event: "Cellular transmission received at gateway" },
        { time: now, event: "Central dashboard received event" },
        { time: now, event: "AI automation validation completed" },
        { time: now, event: "Police control room automatically notified" }
      ],
      createdAt: now,
      updatedAt: now
    };

    this.emergencies.set(emergencyId, record);

    // Record standardized police alert in policeAlerts collection
    const alertId = `ALT-2026-${String(this.policeAlerts.size + 1).padStart(3, '0')}`;
    this.policeAlerts.set(alertId, {
      alertId,
      eventId: emergencyId,
      deviceId: record.deviceId,
      userId: record.userId,
      status: record.status,
      priority: record.priority,
      latitude: record.latitude,
      longitude: record.longitude,
      heartRate: record.heartRate,
      spo2: record.spo2,
      battery: record.battery,
      trackingUrl: record.trackingUrl,
      createdAt: now
    });

    // Initial location history entry if coordinates exist
    if (record.latitude !== null && record.longitude !== null) {
      const history = [{
        latitude: record.latitude,
        longitude: record.longitude,
        timestamp: now
      }];
      this.locationHistory.set(emergencyId, history);
    } else {
      this.locationHistory.set(emergencyId, []);
    }

    // Update device active SOS status
    await this.updateDevice(record.deviceId, {
      lastKnownLocation: { latitude: record.latitude, longitude: record.longitude, address: record.address },
      latitude: record.latitude,
      longitude: record.longitude,
      activeEmergencyId: emergencyId,
      emergencyState: "VERIFIED_EMERGENCY",
      trackingStatus: "ACTIVE",
      status: "ONLINE",
      heartRate: record.heartRate,
      spo2: record.spo2,
      battery: record.battery
    });

    return record;
  }

  async updateEmergency(emergencyId, updateData) {
    const existing = this.emergencies.get(emergencyId);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    // If a new timeline event is provided, append it
    if (updateData.newEvent) {
      updated.timeline = [
        ...existing.timeline,
        {
          time: new Date().toISOString(),
          event: updateData.newEvent
        }
      ];
      delete updated.newEvent;
    }

    this.emergencies.set(emergencyId, updated);

    // If resolved, clear activeEmergencyId from device
    if (updated.status === 'RESOLVED' && updated.deviceId) {
      await this.updateDevice(updated.deviceId, { activeEmergencyId: null });
    }

    return updated;
  }

  // LOCATION TRACKING
  async addEmergencyLocation(emergencyId, locationPoint) {
    const history = this.locationHistory.get(emergencyId) || [];
    const point = {
      latitude: locationPoint.latitude,
      longitude: locationPoint.longitude,
      timestamp: locationPoint.timestamp || new Date().toISOString()
    };
    history.push(point);
    this.locationHistory.set(emergencyId, history);

    // Update emergency latest coordinates
    const emg = this.emergencies.get(emergencyId);
    if (emg) {
      emg.latitude = point.latitude;
      emg.longitude = point.longitude;
      if (locationPoint.address) emg.address = locationPoint.address;
      emg.updatedAt = point.timestamp;
      this.emergencies.set(emergencyId, emg);

      // Also update device location
      if (emg.deviceId) {
        await this.updateDevice(emg.deviceId, {
          latitude: point.latitude,
          longitude: point.longitude,
          lastUpdated: point.timestamp
        });
      }
    }

    return { emergencyId, point, totalPoints: history.length };
  }

  async getEmergencyLocations(emergencyId) {
    return this.locationHistory.get(emergencyId) || [];
  }

  async clearEmergencyLocations(emergencyId) {
    const emg = this.emergencies.get(emergencyId);
    const initialPoint = (emg && emg.latitude !== null && emg.longitude !== null) ? [{
      latitude: emg.latitude,
      longitude: emg.longitude,
      timestamp: new Date().toISOString()
    }] : [];
    this.locationHistory.set(emergencyId, initialPoint);
    return initialPoint;
  }

  // AUDIT LOGS
  async addAuditLog(entry) {
    const log = {
      id: `LOG-${String(this.auditLogs.length + 1).padStart(3, '0')}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.auditLogs.unshift(log);
    // Keep max 200 logs
    if (this.auditLogs.length > 200) {
      this.auditLogs.pop();
    }
    return log;
  }

  async getAuditLogs() {
    return this.auditLogs;
  }

  // POLICE ALERTS (Firestore Collection)
  async getPoliceAlerts() {
    return Array.from(this.policeAlerts.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getPoliceAlertById(alertId) {
    return this.policeAlerts.get(alertId) || null;
  }

  async recordPoliceAlert(alertData) {
    const alertId = alertData.alertId || `ALT-2026-${String(this.policeAlerts.size + 1).padStart(3, '0')}`;
    const alert = {
      alertId,
      ...alertData,
      createdAt: alertData.createdAt || new Date().toISOString()
    };
    this.policeAlerts.set(alertId, alert);
    return alert;
  }

  // RESET DEVICE STATE
  async resetDeviceState(deviceId) {
    const existing = this.devices.get(deviceId);
    if (!existing) return null;
    const resetDevice = {
      ...existing,
      status: "ONLINE",
      battery: 84,
      trackingStatus: "IDLE",
      emergencyState: "NORMAL",
      heartRate: 78,
      spo2: 98,
      activeEmergencyId: null,
      lastUpdated: new Date().toISOString()
    };
    this.devices.set(deviceId, resetDevice);
    return resetDevice;
  }

  // AGGREGATE STATS
  async getStats() {
    const userCount = this.users.size;
    const devices = Array.from(this.devices.values());
    const onlineDevices = devices.filter(d => d.status === "ONLINE").length;
    const offlineDevices = devices.filter(d => d.status === "OFFLINE").length;

    const emergencies = Array.from(this.emergencies.values());
    const activeEmergencies = emergencies.filter(e => e.status !== "RESOLVED" && e.status !== "CANCELLED").length;
    const resolvedEmergencies = emergencies.filter(e => e.status === "RESOLVED").length;

    return {
      totalUsers: userCount,
      totalDevices: devices.length,
      onlineDevices,
      offlineDevices,
      activeEmergencies,
      resolvedEmergencies,
      timestamp: new Date().toISOString()
    };
  }
}

export const db = new DatabaseService();
