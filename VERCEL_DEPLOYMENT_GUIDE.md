# 🌐 GuardianBand: 4 Separate Websites Interconnected on Vercel

This guide shows you how to deploy **all 4 websites as separate independent web applications on Vercel**, and keep them **100% interconnected in real time** through the central event bus.

---

## 🏛️ The 4 Standalone Websites Overview

| Website Name | Directory in Repo | Purpose / Role | Suggested Vercel Project Name |
|---|---|---|---|
| 🚔 **Police Control Dashboard** | `websites/police-control-room` | Tactical 911 EOC station, siren alarm, incident dispatch, live map | `guardianband-police` |
| 🖥️ **Central Control Dashboard** | `websites/central-dashboard` | Autonomous fleet command, live biosensors, AI forwarding console | `guardianband-central` |
| ⌚ **Device Simulator Website** | `websites/device-simulator` | Virtual ESP32 smartwatch bezel, 3-press SOS, vitals sliders | `guardianband-simulator` |
| 🛡️ **Guardian and Wearer Portal** | `websites/guardian-portal` | Civilian family portal, wearer health profile, distress tracking | `guardianband-portal` |

---

## 🚀 How to Deploy the 4 Websites Separately on Vercel

Follow these steps in **[vercel.com](https://vercel.com)**:

### 1️⃣ Deploy Website 1: Police Control Dashboard
1. Go to **Vercel** ➔ Click **"Add New..."** ➔ **"Project"**.
2. Select your repository: **`kit29-25bad068/Guardian_Band`**.
3. **Project Name**: `guardianband-police`
4. Click **"Edit"** next to **Root Directory** ➔ Select:
   ```text
   websites/police-control-room
   ```
5. *(Optional)* Under **Environment Variables**, add:
   - `VITE_BACKEND_URL`: `https://your-backend.onrender.com` (if backend is deployed)
6. Click **"Deploy"**! ➔ Deployed at `https://guardianband-police.vercel.app`.

---

### 2️⃣ Deploy Website 2: Central Control Dashboard
1. In Vercel, click **"Add New..."** ➔ **"Project"**.
2. Select the repository **`kit29-25bad068/Guardian_Band`** again.
3. **Project Name**: `guardianband-central`
4. Click **"Edit"** next to **Root Directory** ➔ Select:
   ```text
   websites/central-dashboard
   ```
5. *(Optional)* Add `VITE_BACKEND_URL`.
6. Click **"Deploy"**! ➔ Deployed at `https://guardianband-central.vercel.app`.

---

### 3️⃣ Deploy Website 3: Device Simulator Website
1. In Vercel, click **"Add New..."** ➔ **"Project"**.
2. Select the repository **`kit29-25bad068/Guardian_Band`** again.
3. **Project Name**: `guardianband-simulator`
4. Click **"Edit"** next to **Root Directory** ➔ Select:
   ```text
   websites/device-simulator
   ```
5. *(Optional)* Add `VITE_BACKEND_URL`.
6. Click **"Deploy"**! ➔ Deployed at `https://guardianband-simulator.vercel.app`.

---

### 4️⃣ Deploy Website 4: Guardian and Wearer Portal Website
1. In Vercel, click **"Add New..."** ➔ **"Project"**.
2. Select the repository **`kit29-25bad068/Guardian_Band`** again.
3. **Project Name**: `guardianband-portal`
4. Click **"Edit"** next to **Root Directory** ➔ Select:
   ```text
   websites/guardian-portal
   ```
5. *(Optional)* Add `VITE_BACKEND_URL`.
6. Click **"Deploy"**! ➔ Deployed at `https://guardianband-portal.vercel.app`.

---

## ⚡ How the 4 Separate Websites Interconnect in Real Time

```
     ┌─────────────────────────────────────────────────────────────┐
     │                DEVICE SIMULATOR WEBSITE                    │
     │            (https://guardianband-simulator.vercel.app)      │
     └──────────────────────────────┬──────────────────────────────┘
                                    │ 1. Triggers SOS (POST /api/device/sos)
                                    ▼
     ┌─────────────────────────────────────────────────────────────┐
     │              SHARED REAL-TIME BACKEND ENGINE                │
     │            (Render.com / Node.js + Socket.IO)               │
     │            (https://guardianband-backend.onrender.com)      │
     └──────┬───────────────────────┼───────────────────────┬──────┘
            │                       │                       │
 2. Live Broadcast       2. Live Telemetry       2. Status Update
            ▼                       ▼                       ▼
┌────────────────────────┐┌────────────────────────┐┌────────────────────────┐
│  CENTRAL CONTROL       ││  POLICE CONTROL        ││  GUARDIAN & WEARER     │
│  DASHBOARD             ││  DASHBOARD             ││  PORTAL                │
│  (central.vercel.app)  ││  (police.vercel.app)   ││  (portal.vercel.app)   │
└────────────────────────┘└────────────────────────┘└────────────────────────┘
```

### 1. Cross-Website Real-Time Data Flow:
- When you press **SOS** on the **Device Simulator Website**:
  - The signal is ingested by the central backend.
  - The **Central Control Dashboard** displays the new verified event and runs AI validation.
  - The **Police Control Dashboard** sounds the audible chime, displays a flashing alert banner, and plots the live pulsating red pin on the radar map.
  - The **Guardian Portal** shows the distress notification and live location tracking.
- When the police officer clicks **"DISPATCH UNIT"** or **"RESOLVE INCIDENT"** on the Police Dashboard:
  - Both Central Dashboard and Guardian Portal update instantly!

### 2. Cross-Website 1-Click Navigation:
- Every website has the **"4 WEBSITES NETWORK"** launcher button in the top right.
- Click it to view the status of all 4 websites and jump directly to any of the other 3 websites in a new window or tab.
- Click **"🚀 LAUNCH ALL 4 WEBSITES"** to open all 4 websites simultaneously in 4 tiled browser windows across your screen!
- Click **"URL Settings"** inside the modal to save your specific Vercel URLs so they persist permanently.

---

## 🛠️ Free 1-Click Backend Deployment (Render.com)

Because Vercel is serverless, persistent WebSockets (`Socket.IO`) run on **Render.com** (which has a free tier):

1. Log into **[render.com](https://render.com)** with your GitHub account.
2. Click **"New +"** ➔ **"Blueprint"**.
3. Select your repository: **`kit29-25bad068/Guardian_Band`**.
4. Render automatically reads [`render.yaml`](./render.yaml), sets up the Node.js service, and builds it in ~60 seconds.
5. Copy your Render URL (e.g., `https://guardianband-backend.onrender.com`).
6. Set this URL in each of your 4 Vercel projects under **Settings ➔ Environment Variables ➔ `VITE_BACKEND_URL`** (or paste it into the **"Real-Time Backend Server"** box in the in-app Network Launcher).
