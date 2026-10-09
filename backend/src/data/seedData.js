export const seedUsers = [
  {
    userId: "USER-1024",
    name: "Priya Sharma",
    phone: "+91 98765 43210",
    email: "priya.sharma@example.com",
    emergencyContact: {
      name: "Rajesh Sharma",
      relation: "Spouse",
      phone: "+91 98765 43219"
    },
    deviceId: "GB-1024",
    role: "USER",
    address: "Kalaignar Karunanidhi Institute of Technology, Kannampalayam, Coimbatore",
    bloodGroup: "O+",
    allergies: "Penicillin",
    medicalNotes: "Asthmatic (inhaler usually carried)",
    createdAt: "2026-01-15T10:00:00Z"
  },
  {
    userId: "USER-2048",
    name: "Karthik Sundaram",
    phone: "+91 98765 43211",
    email: "karthik.s@example.com",
    emergencyContact: {
      name: "Deepa Sundaram",
      relation: "Sister",
      phone: "+91 98765 43218"
    },
    deviceId: "GB-2048",
    role: "USER",
    address: "Avinashi Road, Peelamedu, Coimbatore",
    bloodGroup: "A+",
    allergies: "None",
    medicalNotes: "No chronic conditions",
    createdAt: "2026-02-10T14:30:00Z"
  },
  {
    userId: "USER-3096",
    name: "Ananya Raman",
    phone: "+91 98765 43212",
    email: "ananya.r@example.com",
    emergencyContact: {
      name: "Suresh Raman",
      relation: "Brother",
      phone: "+91 98765 43217"
    },
    deviceId: "GB-3096",
    role: "USER",
    address: "Cross Cut Road, Gandhipuram, Coimbatore",
    bloodGroup: "B-",
    allergies: "Sulfa antibiotics",
    medicalNotes: "Diabetic Type 1",
    createdAt: "2026-03-01T09:15:00Z"
  }
];

export const seedDevices = [
  {
    deviceId: "GB-1024",
    userId: "USER-1024",
    token: "tok_gb1024_secure",
    status: "ONLINE",
    battery: 84,
    source: "SIMULATOR",
    trackingStatus: "IDLE",
    emergencyState: "NORMAL",
    heartRate: 78,
    spo2: 98,
    latitude: 10.9993,
    longitude: 77.0842,
    address: "Kalaignar Karunanidhi Institute of Technology, Coimbatore",
    gpsStatus: "AVAILABLE",
    cellularStatus: "CONNECTED",
    cellularSignalDbm: -68,
    firmwareVersion: "v2.4.1-rc3",
    lastHeartbeat: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  },
  {
    deviceId: "GB-2048",
    userId: "USER-2048",
    token: "tok_gb2048_secure",
    status: "ONLINE",
    battery: 42,
    source: "SIMULATOR",
    trackingStatus: "IDLE",
    emergencyState: "DISPATCHED",
    heartRate: 112,
    spo2: 96,
    latitude: 11.0268,
    longitude: 77.0028,
    address: "Peelamedu, Coimbatore, Tamil Nadu",
    gpsStatus: "AVAILABLE",
    cellularStatus: "CONNECTED",
    cellularSignalDbm: -74,
    firmwareVersion: "v2.4.0",
    lastHeartbeat: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  },
  {
    deviceId: "GB-3096",
    userId: "USER-3096",
    token: "tok_gb3096_secure",
    status: "OFFLINE",
    battery: 12,
    source: "PHYSICAL_DEVICE",
    trackingStatus: "IDLE",
    emergencyState: "NORMAL",
    heartRate: 72,
    spo2: 99,
    latitude: 11.0168,
    longitude: 76.9678,
    address: "Gandhipuram Central, Coimbatore, Tamil Nadu",
    gpsStatus: "UNAVAILABLE",
    cellularStatus: "DISCONNECTED",
    cellularSignalDbm: -110,
    firmwareVersion: "v2.3.9",
    lastHeartbeat: new Date(Date.now() - 3600000).toISOString(),
    lastUpdated: new Date(Date.now() - 3600000).toISOString()
  }
];

export const seedEmergencies = [
  {
    emergencyId: "EMG-2026-001",
    eventId: "EMG-2026-001",
    userId: "USER-2048",
    deviceId: "GB-2048",
    status: "DISPATCHED",
    priority: "HIGH",
    heartRate: 112,
    spo2: 96,
    battery: 42,
    policeEscalationStatus: "SENT",
    trackingUrl: "/portal?id=EMG-2026-001",
    triggerTime: new Date(Date.now() - 900000).toISOString(),
    verificationTime: new Date(Date.now() - 885000).toISOString(),
    verificationMethod: "NO_RESPONSE_TIMEOUT",
    latitude: 11.0268,
    longitude: 77.0028,
    address: "Avinashi Road, Peelamedu, Coimbatore",
    policeStatus: "DISPATCHED",
    dispatchedUnit: "Patrol Vehicle 14 - Sub-Inspector Murugan",
    timeline: [
      { time: new Date(Date.now() - 900000).toISOString(), event: "SOS trigger (Press 1)" },
      { time: new Date(Date.now() - 898500).toISOString(), event: "Second deliberate press" },
      { time: new Date(Date.now() - 898500).toISOString(), event: "\"ARE YOU SAFE?\" initiated (15s countdown)" },
      { time: new Date(Date.now() - 885000).toISOString(), event: "No response within 15 seconds" },
      { time: new Date(Date.now() - 885000).toISOString(), event: "🚨 SOS VERIFIED" },
      { time: new Date(Date.now() - 884000).toISOString(), event: "Cellular transmission received" },
      { time: new Date(Date.now() - 883000).toISOString(), event: "Central dashboard received event" },
      { time: new Date(Date.now() - 882000).toISOString(), event: "AI validation completed (Priority: HIGH)" },
      { time: new Date(Date.now() - 881000).toISOString(), event: "Police control room notified automatically" },
      { time: new Date(Date.now() - 750000).toISOString(), event: "Officer dispatched: Patrol Vehicle 14" }
    ],
    aiReport: {
      validation: "VERIFIED",
      priority: "HIGH",
      summary: "High priority distress signal verified via automated 15-second timeout. Wearer located near Peelamedu transit junction.",
      routing: "AUTOMATIC_TRANSFER_COMPLETE",
      recommendedAction: "Dispatch nearest Coimbatore East police unit to Peelamedu junction."
    },
    createdAt: new Date(Date.now() - 885000).toISOString(),
    updatedAt: new Date(Date.now() - 750000).toISOString()
  }
];

export const seedLocationHistory = {
  "EMG-2026-001": [
    { latitude: 11.0240, longitude: 77.0010, timestamp: new Date(Date.now() - 885000).toISOString() },
    { latitude: 11.0250, longitude: 77.0018, timestamp: new Date(Date.now() - 850000).toISOString() },
    { latitude: 11.0260, longitude: 77.0024, timestamp: new Date(Date.now() - 800000).toISOString() },
    { latitude: 11.0268, longitude: 77.0028, timestamp: new Date(Date.now() - 750000).toISOString() }
  ]
};

export const seedAuditLogs = [
  {
    id: "LOG-001",
    timestamp: new Date(Date.now() - 881000).toISOString(),
    eventType: "EMERGENCY_ESCALATED",
    severity: "HIGH",
    details: "EMG-2026-001 automatically transferred to Central & Police dispatch.",
    userId: "USER-2048",
    deviceId: "GB-2048"
  },
  {
    id: "LOG-002",
    timestamp: new Date(Date.now() - 750000).toISOString(),
    eventType: "STATUS_UPDATE",
    severity: "INFO",
    details: "EMG-2026-001 status changed to DISPATCHED by Control Room Operator.",
    userId: "USER-2048",
    deviceId: "GB-2048"
  }
];
