# 🚀 GuardianBand Vercel Deployment Guide

Deploying GuardianBand to **Vercel** takes less than **2 minutes**. Follow these simple steps.

---

## 🌟 Option 1: 1-Click All-in-One Deployment (Recommended)

This deploys the unified GuardianBand portal where all 4 websites are accessible under a single domain:
- `https://your-app.vercel.app/` ➔ 🌐 Multi-Website Network Hub
- `https://your-app.vercel.app/police` ➔ 🚔 Police Emergency Control Room
- `https://your-app.vercel.app/central` ➔ 📊 Central Operations Dashboard
- `https://your-app.vercel.app/guardian` ➔ 🛡️ Guardian & Wearer Portal
- `https://your-app.vercel.app/simulator` ➔ ⌚ Virtual Smartband Simulator

### Step-by-Step Instructions:

1. Go to **[vercel.com](https://vercel.com)** and log in with your GitHub account.
2. Click **"Add New..."** ➔ **"Project"**.
3. Under **"Import Git Repository"**, select **`kit29-25bad068/Guardian_Band`**.
4. In the **Configure Project** screen:
   - **Project Name**: `guardian-band` (or any name you prefer)
   - **Framework Preset**: `Vite` (automatically detected)
   - **Root Directory**: Leave as `./` (the root `vercel.json` handles everything automatically)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `frontend/dist` (auto-detected from `vercel.json`)
5. *(Optional)* **Environment Variables**:
   - If you have deployed the backend server on Render or Railway, add:
     - `VITE_BACKEND_URL`: `https://your-backend.onrender.com`
   - If you haven't deployed the backend yet, **leave it blank**! The application includes an intelligent **Live Demo & Fallback Simulation Engine** that runs out of the box with realistic vitals and GPS maps.
6. Click **"Deploy"**! 🚀
7. In about 30 seconds, your site will be live at `https://guardian-band.vercel.app`!

---

## 💻 Option 2: Deploy Each Website Separately on Vercel

If you want separate Vercel URLs for your team members (e.g., `police-control.vercel.app`, `central-dashboard.vercel.app`):

Repeat these steps for each site:
1. On Vercel, click **"Add New Project"** and select **`kit29-25bad068/Guardian_Band`**.
2. Click **Edit** next to **Root Directory**:
   - For Police Control Room: choose `websites/police-control-room`
   - For Central Dashboard: choose `websites/central-dashboard`
   - For Guardian Portal: choose `websites/guardian-portal`
   - For Device Simulator: choose `websites/device-simulator`
3. Click **"Deploy"**!

---

## ⚡ Connecting the Real-Time Backend (WebSockets / Socket.IO)

> [!NOTE]
> Vercel is a serverless platform designed for frontends and serverless edge functions. It does **not** support persistent long-lived WebSockets (`Socket.IO`).
> For full real-time cross-device synchronization between different laptops/phones, deploy the backend server to **Render.com** (Free tier available).

### 1-Click Render.com Backend Deployment:
1. Go to **[render.com](https://render.com)** and sign in with GitHub.
2. Click **"New +"** ➔ **"Blueprint"** (or **"Web Service"**).
3. Select the repository **`kit29-25bad068/Guardian_Band`**.
4. Render automatically reads [`render.yaml`](./render.yaml) and configures:
   - **Build Command**: `npm --prefix backend install`
   - **Start Command**: `node backend/src/server.js`
   - **Port**: `5000`
5. Click **"Apply"** / **"Create Web Service"**.
6. Once deployed, Render gives you a URL like: `https://guardianband-backend.onrender.com`.

### Linking the Backend to Vercel:
You have two easy ways to link your backend:
1. **Via Vercel Environment Variables**:
   In Vercel Project Settings ➔ **Environment Variables**, set:
   `VITE_BACKEND_URL` = `https://guardianband-backend.onrender.com`
2. **Via In-App Settings**:
   Open your Vercel website, click the **"4 WEBSITES NETWORK"** pill at the top, paste your backend URL into the **"Real-Time Backend Server"** box, and click **"Connect"**!
