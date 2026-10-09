# GuardianBand Ecosystem - Local Setup & Execution Guide

Welcome to the **GuardianBand Complete System**! This package contains all 4 independent websites, the central Node.js real-time backend engine, and ESP32 hardware firmware.

---

## 📁 What is Inside this Package?

```
guardianband/
├── backend/                        # Central Node.js + Express + Socket.IO Backend (Port 5000)
│   ├── src/
│   │   ├── controllers/            # Emergency, Device, User, SMS controllers
│   │   ├── services/               # SocketService, Notification, Twilio/SMSLocal
│   │   ├── routes/                 # REST API routes
│   │   └── server.js               # Main API & WebSocket entry point
│   └── package.json
│
├── websites/                       # The 4 Independent Standalone Websites
│   ├── police-control-room/        # Police Emergency Control Room (Port 5174)
│   ├── central-dashboard/          # Central Operations Command Console (Port 5173)
│   ├── guardian-portal/            # Guardian & Wearer Safety Portal (Port 5175)
│   └── device-simulator/           # Virtual Wearable Smartwatch Bench (Port 5176)
│
├── hardware/                       # ESP32 Physical Device Firmware
│   └── esp32_guardianband.ino      # C++/Arduino code for GPS + MAX30102 + SIM800L
│
├── START_SYSTEM.bat                # 🚀 1-Click launcher for Windows (Starts all 5 services)
├── INSTALL_ALL.bat                 # 📦 1-Click dependency installer
├── package.json                    # Root project workspace orchestration
└── README.md                       # Complete technical documentation
```

---

## 🚀 Quickest Way to Run (Windows)

### Option 1: Double-Click Launcher (Recommended)
1. Double-click `START_SYSTEM.bat`.
2. It will automatically detect if dependencies are installed, install them if needed, launch each website in its own terminal window, and open all 4 websites in your browser!

### Option 2: Command Line (PowerShell / Command Prompt)

1. **Install all dependencies** (run once):
   ```bash
   npm run install:all
   ```

2. **Start the Backend Engine** (Port 5000):
   ```bash
   npm run backend
   ```

3. **Start the 4 Websites** (in separate terminal tabs/windows):
   ```bash
   npm run dev:central      # Central Operations Dashboard (http://localhost:5173)
   npm run dev:police       # Police Emergency Control Room (http://localhost:5174)
   npm run dev:guardian     # Guardian & Wearer Portal (http://localhost:5175)
   npm run dev:simulator    # Wearable Device Simulator (http://localhost:5176)
   ```

---

## 🌐 Website URLs & Ports Summary

| Component | Port | Local URL | Description |
|---|---|---|---|
| **Central Operations Dashboard** | `5173` | [http://localhost:5173](http://localhost:5173) | Global command center, device tracking & fleet dispatch |
| **Police Emergency Control Room** | `5174` | [http://localhost:5174](http://localhost:5174) | Tactical emergency HUD, siren alerts, 1-click police dispatch |
| **Guardian & Wearer Portal** | `5175` | [http://localhost:5175](http://localhost:5175) | Family/guardian view, wearer status, emergency contacts |
| **Wearable Device Simulator** | `5176` | [http://localhost:5176](http://localhost:5176) | Software twin of smartband, single-click SOS, vitals sliders |
| **Backend API Engine** | `5000` | [http://localhost:5000/health](http://localhost:5000/health) | REST API & real-time Socket.IO WebSocket bus |

---

## ⚡ Testing the End-to-End System

1. Open **Wearable Device Simulator** (`http://localhost:5176`) and **Police Control Room** (`http://localhost:5174`) side by side.
2. In the Simulator, click **EMERGENCY SOS**.
3. Confirm the 2nd press within 5 seconds.
4. Watch the 15-second "ARE YOU SAFE?" countdown expire (or click "I NEED HELP NOW!").
5. Instantly watch the **Police Control Room** flash red, play the tactical siren, and plot the moving emergency GPS pin on the map in real time!
