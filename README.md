# GuardianBand: Autonomous Smart Emergency SOS Wearable & Police Control Platform

GuardianBand is an end-to-end, mission-critical emergency response system designed to detect and verify distress signals through a smart wearable band and immediately escalate them to a Police Control Room (EOC) with **zero manual operator intervention delays**.

---

## 1. The Exact GuardianBand Workflow

```
                                  GUARDIANBAND
                                       │
                       ┌───────────────┴────────────────┐
                       │                                │
                 ESP32 LOCAL STORAGE                 SENSORS
                       │                                │
              ┌────────┼────────────┐          ┌────────┴────────┐
              │        │            │          │                 │
          User Info  Device ID   Emergency    GPS            MAX30102
                                 Contact      Location        HR + SpO₂
              │
              └──── User Dashboard / Tracking URL
                                       │
                                       ▼
                                  NORMAL STATE
                                       │
                                       ▼
                                1st SOS PRESS
                                       │
                                       ▼
                                2nd SOS PRESS
                                       │
                                       ▼
                             START 15-SECOND TIMER
                                       │
                              ┌────────┴────────┐
                              │                 │
                       3rd Press within      No 3rd Press
                          15 seconds          for 15 seconds
                              │                 │
                              ▼                 ▼
                      EMERGENCY CANCELLED   VERIFIED
                              │              EMERGENCY
                              ▼                 │
                            NORMAL              ▼
                                       Collect Emergency Data
                                               │
                              ┌────────────────┴────────────────┐
                              │                                 │
                              ▼                                 ▼
                           SIM800L                           SIM800L
                             SMS                               GPRS
                              │                                 │
                              ▼                                 ▼
                      Emergency Contacts                  Node.js Backend
                                                                │
                                                                ▼
                                                             Firebase
                                                                │
                                                                ▼
                                                    CENTRAL CONTROL DASHBOARD
                                                                │
                                                      ┌─────────┴─────────┐
                                                      │                   │
                                                      ▼                   ▼
                                               LIVE GPS TRACKING    AI FORWARDING
                                                      │                   │
                                                      │                   ▼
                                                      │            POLICE CONTROL
                                                      │                ROOM
                                                      │
                                                      ▼
                                             Continuous Location
                                               Monitoring
                                                      │
                                                      ▼
                                             Emergency Resolved
                                                      │
                                                      ▼
                                                    NORMAL
```

### Safety Rules & Logic
1. **1st SOS Press & 2nd SOS Press**: Requires two deliberate presses within 3 seconds to arm the verification sequence, preventing false alarms.
2. **15-Second Safety Verification Timer**: Initiates the countdown. The band shows countdown prompts and vibrates.
3. **3rd Press Within 15s**: Cancels the emergency immediately, resets the device to `NORMAL` state, and logs the cancellation event.
4. **No 3rd Press for 15s**: Flags a **VERIFIED EMERGENCY**. Immediately collects telemetry (GPS coordinates, MAX30102 Heart Rate + SpO₂).
5. **Dual Dispatch (SIM800L SMS & GPRS)**:
   - **SMS**: Dispatches direct distress messages with live Google Maps links directly to registered emergency contacts.
   - **GPRS (Cellular)**: Sends telemetry payloads to the Node.js backend & Firebase cloud instance.
6. **Central Control Dashboard**: Ingests the incident in real-time, displays Live GPS Tracking, and triggers AI Forwarding.
7. **AI Forwarding to Police Control Room**: Generates incident classification, anomaly risk analysis, and automatically routes the emergency to the tactical Police Control Room HUD with audible chimes and live pulsating beacon tracking.
8. **Continuous Location Monitoring**: Tracks live wearer movement until marked **RESOLVED** by law enforcement operators.

---

## 2. Project Architecture & Structure

```
guardianband/
├── backend/
│   ├── src/
│   │   ├── data/
│   │   │   └── seedData.js          # Seed users, devices, emergencies, audit logs
│   │   ├── routes/
│   │   │   ├── deviceRoutes.js      # Hardware cellular endpoints (SOS, location, status, cancel)
│   │   │   ├── emergencyRoutes.js   # Police EOC incident management & status transitions
│   │   │   ├── userRoutes.js        # User & guardian data APIs
│   │   │   └── statRoutes.js        # Central fleet telemetry & audit log APIs
│   │   ├── services/
│   │   │   ├── db.js                # Dual-engine Firestore / reactive local store
│   │   │   ├── aiAutomation.js      # Explainable AI validation, priority grading, & summary
│   │   │   └── socketService.js     # Real-time WebSocket event broadcaster
│   │   └── server.js                # Express + Socket.IO server & static frontend hosting
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── EmergencyMap.tsx     # Dark tactical Leaflet map with live pulsating SOS pin & breadcrumbs
│   │   ├── pages/
│   │   │   ├── PoliceControlRoom.tsx# Tactical EOC dashboard matching ASCII operations center layout
│   │   │   ├── CentralDashboard.tsx # Fleet health, telemetry stats, and live audit feed
│   │   │   ├── UserGuardianPortal.tsx# Linked wearable status, guardian view, and incident history
│   │   │   └── DeviceSimulator.tsx  # Wearable hardware simulator with OLED screen & GPS route streamer
│   │   ├── services/
│   │   │   └── api.ts               # Typed API client and Socket.IO connection
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript interfaces for all system entities
│   │   ├── utils/
│   │   │   └── audioAlert.ts        # Web Audio API synthesized emergency chime
│   │   ├── App.tsx                  # Main router with tactical navigation bar
│   │   └── index.css                # Tailwind CSS v4 & custom radar animations
│   ├── package.json
│   └── vite.config.ts
│
├── hardware/
│   └── esp32_guardianband.ino       # ESP32 + SIM7600/SIM800L C++ Arduino firmware
├── firestore.rules                  # Role-based Firestore security rules
└── README.md
```

---

## 3. Quick Setup & Run Commands

### Prerequisites
- Node.js (v18+) and npm.

### Quick Start (Runs Backend & Frontend simultaneously)

#### Option 1: Development Mode with Vite Hot Reload (Recommended)

1. **Start Backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   # Runs on http://localhost:5000
   ```

2. **Start Frontend** (in a separate terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   # Runs on http://localhost:5173
   ```

#### Option 2: Production Single-Port Bundle
The backend can serve the compiled frontend directly from port 5000:
```bash
# Build frontend
cd frontend
npm run build

# Start backend
cd ../backend
node src/server.js
# Access both frontend and backend on http://localhost:5000
```

---

## 4. Environment Variables & API Keys

Copy `backend/.env.example` to `backend/.env`:

```env
PORT=5000
DEVICE_AUTH_SECRET=GUARDIAN_DEV_SECRET_TOKEN_2026

# Optional: Google Gemini API key for dynamic tactical AI summary generation.
# If omitted, system runs high-precision deterministic classification with identical schema!
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Firebase credentials if connecting to live Firestore cloud instance
# FIREBASE_PROJECT_ID=
# FIREBASE_CLIENT_EMAIL=
# FIREBASE_PRIVATE_KEY=
```

---

## 5. Firebase Firestore Schema & Security Rules

### Firestore Collections:
1. `users/{userId}`:
   - `name`, `phone`, `email`, `emergencyContact: { name, relation, phone }`, `deviceId`, `bloodGroup`, `medicalNotes`, `createdAt`
2. `devices/{deviceId}`:
   - `userId`, `status` (`ONLINE`/`OFFLINE`), `battery` (0-100), `latitude`, `longitude`, `gpsStatus`, `cellularStatus`, `firmwareVersion`, `lastHeartbeat`
3. `emergencies/{emergencyId}`:
   - `userId`, `deviceId`, `status` (`NEW`, `ACKNOWLEDGED`, `DISPATCHED`, `RESOLVED`, `CANCELLED`), `priority` (`CRITICAL`, `HIGH`, `MEDIUM`), `triggerTime`, `verificationTime`, `verificationMethod`, `latitude`, `longitude`, `address`, `policeStatus`, `aiStatus`, `aiReport`, `timeline: []`
4. `emergencies/{emergencyId}/locationHistory/{pointId}`:
   - `latitude`, `longitude`, `timestamp`, `address`
5. `auditLogs/{logId}`:
   - `eventType`, `severity`, `details`, `userId`, `deviceId`, `timestamp`

### Deploying Security Rules:
```bash
firebase deploy --only firestore:rules
```
*(The complete rules file is provided in [`firestore.rules`](file:///C:/Users/Lenovo/.gemini/antigravity/scratch/guardianband/firestore.rules))*

---

## 6. How to Perform the Complete 12-Step Demonstration

Open the application at `http://localhost:5173` (or `http://localhost:5000`):

1. **Step 1 - View Police Control Room**:
   - Open the **POLICE CONTROL ROOM** tab. Note the top stats (`ACTIVE SOS`, `ONLINE DEVICES`, `TOTAL USERS`) and the live tactical radar map.
2. **Step 2 - Open Device Simulator**:
   - In a second tab or window, open the **DEVICE SIMULATOR** tab.
3. **Step 3 - First SOS Press**:
   - Click the red **SOS button** on the wearable bezel once.
   - Observe that **no emergency is created**. The OLED display flashes `"1ST PRESS DETECTED - PRESS AGAIN (3s)"`.
4. **Step 4 - Second Deliberate Press**:
   - Press the red SOS button a second time within 3 seconds.
   - The OLED display immediately switches to **"ARE YOU SAFE?"** and begins the **15-second countdown** (`15`, `14`... `1`).
5. **Step 5 - Let Timer Expire (No Response)**:
   - Do not click anything.
   - When the countdown reaches 0, the wearable displays `🚨 SOS VERIFIED`.
6. **Step 6 - Backend Cellular Ingestion**:
   - The simulator automatically sends the payload to `POST /api/device/sos` with `x-device-token: tok_gb1024_secure`.
   - The backend creates a new emergency record (e.g., `EMG-2026-002`).
7. **Step 7 - Central Dashboard Ingestion**:
   - The Central Dashboard receives the cellular packet in real-time over WebSockets.
8. **Step 8 - AI Automation**:
   - The AI Automation module validates coordinates, verifies completeness, determines priority (`HIGH`), generates the tactical summary, and confirms automatic transfer.
9. **Step 9 - Automatic Transfer to Police**:
   - Zero human intervention needed.
10. **Step 10 - Police Dashboard Receives Alert**:
    - Switch to the **Police Control Room** tab.
    - A gentle dual-tone synthesized chime plays.
    - A toast alert appears: `🚨 NEW VERIFIED SOS: EMG-2026-002`.
    - A pulsating red beacon marker appears on the live map at Civic Center.
    - The Selected Emergency panel shows the exact timeline:
      ```text
      SOS trigger (Press 1)
      Second deliberate press confirmed
      "ARE YOU SAFE?" 15-second countdown active
      No response within 15 seconds
      🚨 SOS VERIFIED
      Cellular transmission received at gateway
      Central dashboard received event
      AI validation completed
      Automatic transfer to Police Control Room initiated
      ```
11. **Step 11 - Stream Live GPS Coordinates**:
    - On the Device Simulator, click **"Auto-Stream Movement (Every 3s)"**.
    - Watch the Police Control Room map: the red beacon moves step-by-step along Market Street, drawing a red breadcrumbs path.
12. **Step 12 - Operator Actions**:
    - On the Police Control Room, click **"ACKNOWLEDGE"** (`NEW → ACKNOWLEDGED`).
    - Click **"DISPATCH UNIT"** (`ACKNOWLEDGED → DISPATCHED`).
    - Click **"RESOLVE INCIDENT"** (`DISPATCHED → RESOLVED`).
    - Check the Central Dashboard and Guardian Portal to verify that the status updated instantly everywhere!

---

## 7. How the Future Physical ESP32 Wearable Connects

The physical device uses an ESP32 microcontroller with a SIMCOM SIM7600 (4G LTE) or SIM800L cellular modem and a u-blox NEO-8M GPS.

### Pinout & Wiring:
- **Tactile Button**: GPIO 14 (Internal pull-up)
- **Cancel Button**: GPIO 27 (Internal pull-up)
- **OLED Display**: I2C SDA (GPIO 21), SCL (GPIO 22)
- **SIM7600 Cellular**: UART Serial2 RX (GPIO 16), TX (GPIO 17)
- **GPS**: UART Serial1 RX (GPIO 18), TX (GPIO 19)

### Cellular AT Commands / HTTPS Request:
```http
POST /api/device/sos HTTP/1.1
Host: your-guardianband-server.com:5000
Content-Type: application/json
x-device-token: tok_gb1024_secure

{
  "deviceId": "GB-1024",
  "userId": "USER-1024",
  "verificationMethod": "NO_RESPONSE_15S",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "battery": 84
}
```

The ready-to-flash Arduino C++ firmware is provided in [`hardware/esp32_guardianband.ino`](file:///C:/Users/Lenovo/.gemini/antigravity/scratch/guardianband/hardware/esp32_guardianband.ino).
