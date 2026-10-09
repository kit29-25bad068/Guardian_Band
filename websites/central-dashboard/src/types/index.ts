export type EmergencyStatus = 'NEW' | 'ACKNOWLEDGED' | 'DISPATCHED' | 'RESOLVED' | 'CANCELLED';
export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface User {
  userId: string;
  name: string;
  phone: string;
  email: string;
  emergencyContact: EmergencyContact;
  secondaryContact?: EmergencyContact;
  deviceId: string;
  role: 'USER' | 'GUARDIAN' | 'POLICE' | 'ADMIN';
  address?: string;
  bloodGroup?: string;
  allergies?: string;
  medicalNotes?: string;
}

export interface Device {
  deviceId: string;
  userId: string;
  token?: string;
  status: 'ONLINE' | 'OFFLINE';
  battery: number;
  source: 'SIMULATOR' | 'PHYSICAL_DEVICE';
  trackingStatus: 'IDLE' | 'ACTIVE';
  heartRate: number;
  spo2: number;
  emergencyState: 'NORMAL' | 'SOS_ACTIVATED' | 'VERIFYING' | 'VERIFIED_EMERGENCY' | 'RESOLVED';
  latitude: number | null;
  longitude: number | null;
  address?: string;
  gpsStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'SEARCHING';
  cellularStatus: 'CONNECTED' | 'DISCONNECTED';
  cellularSignalDbm?: number;
  firmwareVersion: string;
  lastHeartbeat: string;
  lastUpdated: string;
  activeEmergencyId?: string | null;
}

export type DeviceCommand = 
  | 'REQUEST_LOCATION' 
  | 'START_TRACKING' 
  | 'STOP_TRACKING' 
  | 'TEST_SOS' 
  | 'CANCEL_TEST_EMERGENCY' 
  | 'RESET_DEVICE';

export interface PoliceAlert {
  alertId: string;
  eventId: string;
  deviceId: string;
  userId: string;
  status: EmergencyStatus;
  priority: PriorityLevel;
  latitude: number | null;
  longitude: number | null;
  heartRate?: number;
  spo2?: number;
  battery?: number;
  trackingUrl?: string;
  createdAt: string;
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  address?: string;
}

export interface TimelineEvent {
  time: string;
  event: string;
}

export interface AIReport {
  aiStatus: 'COMPLETED' | 'UNAVAILABLE' | 'PENDING';
  validationStatus: string;
  missingFields: string[];
  hasLocation: boolean;
  priority: PriorityLevel;
  recommendedSector: string;
  summary: string;
  automaticPoliceEscalation: string;
  processingTimeMs: number;
  failsafeUsed: boolean;
}

export interface Emergency {
  emergencyId: string;
  eventId?: string;
  userId: string;
  deviceId: string;
  status: EmergencyStatus;
  priority: PriorityLevel;
  triggerTime: string;
  verificationTime: string;
  verificationMethod: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
  heartRate?: number;
  spo2?: number;
  battery?: number;
  policeEscalationStatus?: string;
  trackingUrl?: string;
  policeStatus: EmergencyStatus;
  dispatchedUnit?: string;
  resolutionNotes?: string;
  aiStatus: string;
  aiReport?: AIReport;
  timeline: TimelineEvent[];
  locationHistory?: LocationPoint[];
  user?: Partial<User>;
  device?: Partial<Device>;
  createdAt: string;
  updatedAt: string;
}

export interface SystemStats {
  totalUsers: number;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  activeEmergencies: number;
  resolvedEmergencies: number;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  eventType: string;
  severity: PriorityLevel | 'INFO' | 'WARNING';
  details: string;
  userId?: string;
  deviceId?: string;
  emergencyId?: string;
  operatorId?: string;
}

export interface SMSConfig {
  isConfigured: boolean;
  provider: string;
  apiKeyMasked: string | null;
  senderId: string | null;
  templateId: string | null;
  route?: string;
  messageTemplate?: string;
}

export interface SMSLog {
  id: string;
  emergencyId?: string | null;
  timestamp: string;
  rawTo: string;
  to: string;
  recipientName: string;
  recipientRelation: string;
  message: string;
  isLiveCarrier: boolean;
  status: 'SENT_TO_CARRIER' | 'SIMULATED_LOCAL' | 'FAILED_CARRIER' | 'PENDING' | 'ERROR';
  carrierResponse?: {
    messageId?: string;
    raw?: string;
    sid?: string;
    status?: string;
    to?: string;
  } | null;
  error?: string | null;
}

