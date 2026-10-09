import { io, Socket } from 'socket.io-client';
import type { 
  Emergency, Device, User, SystemStats, AuditLog, 
  EmergencyStatus, SMSConfig, SMSLog, DeviceCommand, PoliceAlert 
} from '../types';

export type { PoliceAlert, DeviceCommand };

// Connect to Socket.IO backend (proxied via Vite or direct origin)
export const socket: Socket = io(window.location.origin, {
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('[Socket] Connected to GuardianBand real-time bus:', socket.id);
  socket.emit('join_room', 'police');
});

socket.on('connect_error', (err) => {
  console.warn('[Socket] Connection issue:', err.message);
});

export const api = {
  // Stats
  async getStats(): Promise<SystemStats> {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();
    return data.stats;
  },

  // Police Alerts
  async getPoliceAlerts(): Promise<PoliceAlert[]> {
    const res = await fetch('/api/emergencies');
    if (!res.ok) throw new Error('Failed to fetch police alerts');
    const data = await res.json();
    return data.emergencies || [];
  },

  // Devices
  async getDevices(): Promise<Device[]> {
    const res = await fetch('/api/devices');
    if (!res.ok) throw new Error('Failed to fetch devices');
    const data = await res.json();
    return data.devices;
  },

  // Emergencies
  async getEmergencies(filter?: { status?: string; userId?: string }): Promise<Emergency[]> {
    const params = new URLSearchParams();
    if (filter?.status) params.append('status', filter.status);
    if (filter?.userId) params.append('userId', filter.userId);
    const res = await fetch(`/api/emergencies?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch emergencies');
    const data = await res.json();
    return data.emergencies;
  },

  async getEmergencyById(id: string): Promise<Emergency> {
    const res = await fetch(`/api/emergencies/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch emergency ${id}`);
    const data = await res.json();
    return data.emergency;
  },

  async updateEmergencyStatus(
    id: string,
    status: EmergencyStatus,
    operatorId = 'POLICE_EOC_701',
    notes?: string,
    dispatchedUnit?: string
  ): Promise<Emergency> {
    const res = await fetch(`/api/emergencies/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, operatorId, notes, dispatchedUnit })
    });
    if (!res.ok) throw new Error(`Failed to update status for ${id}`);
    const data = await res.json();
    return data.emergency;
  },

  async clearEmergencyTrail(id: string) {
    const res = await fetch(`/api/emergencies/${id}/clear-trail`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`Failed to clear trail for ${id}`);
    return res.json();
  },

  // User routes
  async getUsers(): Promise<User[]> {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('Failed to fetch users');
    const data = await res.json();
    return data.users;
  },

  async getUser(id: string): Promise<User> {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error('Failed to fetch user');
    const data = await res.json();
    return data.user;
  },

  async getUserDevice(userId: string): Promise<Device> {
    const res = await fetch(`/api/users/${userId}/device`);
    if (!res.ok) throw new Error('Failed to fetch user device');
    const data = await res.json();
    return data.device;
  },

  async getUserEmergencies(userId: string): Promise<Emergency[]> {
    const res = await fetch(`/api/users/${userId}/emergencies`);
    if (!res.ok) throw new Error('Failed to fetch user emergencies');
    const data = await res.json();
    return data.emergencies;
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update user profile');
    const data = await res.json();
    return data.user;
  },

  async updateEmergencyContact(
    userId: string,
    contact: { name: string; relation: string; phone: string; secondaryContact?: { name: string; relation: string; phone: string } }
  ): Promise<User> {
    const res = await fetch(`/api/users/${userId}/emergency-contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact)
    });
    if (!res.ok) throw new Error('Failed to update emergency contact');
    const data = await res.json();
    return data.user;
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch('/api/audit-logs');
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    const data = await res.json();
    return data.logs;
  },

  // Hardware Device Simulator API Calls (with token authentication)
  async deviceTriggerSOS(payload: {
    deviceId: string;
    userId: string;
    token?: string;
    triggerTime: string;
    verificationTime: string;
    verificationMethod: string;
    latitude: number | null;
    longitude: number | null;
    address?: string;
    battery?: number;
    cellularSignalDbm?: number;
    heartRate?: number;
    spo2?: number;
    source?: 'SIMULATOR' | 'PHYSICAL_DEVICE';
  }) {
    const res = await fetch('/api/device/sos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': payload.token || 'tok_gb1024_secure'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to trigger device SOS');
    }
    return res.json();
  },

  async deviceSendLocation(payload: {
    deviceId: string;
    userId: string;
    emergencyId?: string;
    latitude: number;
    longitude: number;
    address?: string;
    heartRate?: number;
    spo2?: number;
    token?: string;
  }) {
    const res = await fetch('/api/device/location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': payload.token || 'tok_gb1024_secure'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update location');
    }
    return res.json();
  },

  async deviceCancelSOS(payload: {
    deviceId: string;
    userId: string;
    triggerTime: string;
    cancellationTime: string;
    reason?: string;
    token?: string;
  }) {
    const res = await fetch('/api/device/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': payload.token || 'tok_gb1024_secure'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to cancel SOS');
    return res.json();
  },

  async deviceUpdateTelemetry(payload: {
    deviceId: string;
    battery?: number;
    status?: 'ONLINE' | 'OFFLINE';
    gpsStatus?: 'AVAILABLE' | 'UNAVAILABLE' | 'SEARCHING';
    cellularStatus?: 'CONNECTED' | 'DISCONNECTED';
    heartRate?: number;
    spo2?: number;
    source?: 'SIMULATOR' | 'PHYSICAL_DEVICE';
    trackingStatus?: 'IDLE' | 'ACTIVE';
    emergencyState?: 'NORMAL' | 'SOS_ACTIVATED' | 'VERIFYING' | 'VERIFIED_EMERGENCY' | 'RESOLVED';
    token?: string;
  }) {
    const res = await fetch('/api/device/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': payload.token || 'tok_gb1024_secure'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update telemetry');
    return res.json();
  },

  // Central Dashboard -> Simulator Command Dispatcher
  async sendCommandToDevice(
    deviceId: string, 
    command: DeviceCommand, 
    params?: any
  ): Promise<{ success: boolean; message: string; command: DeviceCommand; device: Device }> {
    // 1. Emit directly via socket for instant zero-latency push
    socket.emit('dashboard:command', { deviceId, command, params });

    // 2. Also dispatch via REST API for reliability and audit persistence
    const res = await fetch(`/api/device/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, params })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Failed to dispatch command ${command}`);
    }
    return res.json();
  },

  async resetDevice(deviceId: string): Promise<{ success: boolean; message: string; device: Device }> {
    const res = await fetch(`/api/device/${deviceId}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`Failed to reset device ${deviceId}`);
    return res.json();
  },

  // Test Mode generator
  async generateTestEmergency(payload?: { userId?: string; deviceId?: string; latitude?: number; longitude?: number }) {
    const res = await fetch('/api/emergencies/test/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    if (!res.ok) throw new Error('Failed to generate test emergency');
    return res.json();
  },

  // SMS Gateway Management
  async getSMSStatus(): Promise<{
    success: boolean;
    config: SMSConfig;
    totalDispatched: number;
    carrierDelivered: number;
    simulated: number;
    failed: number;
    recentLogs: SMSLog[];
  }> {
    const res = await fetch('/api/sms/status');
    if (!res.ok) throw new Error('Failed to fetch SMS status');
    return res.json();
  },

  async updateSMSConfig(config: {
    apiKey?: string;
    senderId?: string;
    templateId?: string;
    messageTemplate?: string;
  }): Promise<{ success: boolean; message: string; config: SMSConfig }> {
    const res = await fetch('/api/sms/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to update SMS configuration');
    return res.json();
  },

  async getSMSLogs(): Promise<SMSLog[]> {
    const res = await fetch('/api/sms/logs');
    if (!res.ok) throw new Error('Failed to fetch SMS logs');
    const data = await res.json();
    return data.logs;
  },

  async sendTestSMS(payload: { phone?: string; recipientName?: string; userId?: string }): Promise<{
    success: boolean;
    message: string;
    result: SMSLog;
  }> {
    const res = await fetch('/api/sms/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send test SMS');
    return data;
  },

  async triggerTestEmergencySMS(payload: {
    userId?: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
    location?: string;
  }): Promise<{
    success: boolean;
    message: string;
    result: SMSLog;
  }> {
    const res = await fetch('/api/test/emergency-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to trigger test emergency SMS');
    return data;
  }
};
