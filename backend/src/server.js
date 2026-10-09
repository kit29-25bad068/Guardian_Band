import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import deviceRoutes from './routes/deviceRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import userRoutes from './routes/userRoutes.js';
import statRoutes from './routes/statRoutes.js';
import smsRoutes, { handleTestEmergencySMS } from './routes/smsRoutes.js';
import { socketService } from './services/socketService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Real-time WebSocket server
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

socketService.init(io);

// Security and standard middlewares
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Mount routes
app.use('/api/device', deviceRoutes);
app.use('/api/emergencies', emergencyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sms', smsRoutes);
app.post('/api/test/emergency-sms', handleTestEmergencySMS);
app.use('/api', statRoutes);

// System health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'GuardianBand Mission Critical API',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Team Laptop Distribution Hub & Download Endpoints
app.get('/download', (req, res) => {
  const files = [
    { name: '1_Police_Control_Room.zip', title: '🚔 1. Police Emergency Control Room', desc: 'Port 5174: Tactical HUD, siren alarms, incident dispatch, live map', badge: 'Police Laptop' },
    { name: '2_Central_Dashboard.zip', title: '🖥️ 2. Central Operations Dashboard', desc: 'Port 5173: Fleet command, live telemetry, device tracking & commands', badge: 'Central Laptop' },
    { name: '3_Guardian_Portal.zip', title: '🛡️ 3. Guardian & Wearer Safety Portal', desc: 'Port 5175: Family monitoring, SMS gateway logs, personal tracker', badge: 'Guardian Laptop' },
    { name: '4_Device_Simulator.zip', title: '⌚ 4. Wearable Device Simulator', desc: 'Port 5176: Virtual Smartband OLED, single-click SOS, HR & SpO2 sliders', badge: 'Wearer Laptop' },
    { name: '5_Backend_Server.zip', title: '⚡ 5. Central Backend Server', desc: 'Port 5000: Node.js, Express & Socket.IO real-time engine & SQLite/Memory DB', badge: 'Server Laptop' },
    { name: 'GuardianBand_Complete_All_In_One.zip', title: '📦 Complete GuardianBand Ecosystem', desc: 'All 4 websites, backend server, hardware firmware & batch runners', badge: 'Master Package' }
  ];

  const cardsHtml = files.map(f => `
    <div style="background:#131b2e; border:1px solid #1e293b; border-radius:10px; padding:20px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <h3 style="margin:0; font-size:18px; color:#f1f5f9;">${f.title}</h3>
          <span style="background:#1e293b; color:#38bdf8; font-size:12px; padding:2px 8px; border-radius:12px; font-weight:bold; border:1px solid #0284c7;">${f.badge}</span>
        </div>
        <p style="margin:6px 0 0 0; color:#94a3b8; font-size:14px;">${f.desc}</p>
      </div>
      <a href="/download/${f.name}" style="background:#0284c7; color:#fff; text-decoration:none; padding:10px 18px; border-radius:6px; font-weight:bold; font-size:14px; display:inline-block;">Download .ZIP</a>
    </div>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>GuardianBand Team Distribution Hub</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090d16; color: #e2e8f0; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
          .container { max-width: 820px; width: 100%; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="margin-bottom:24px; border-bottom:1px solid #1e293b; padding-bottom:16px;">
            <h1 style="color:#ef4444; margin:0 0 8px 0; font-size:26px;">🚨 GuardianBand Team Laptop Distribution Hub</h1>
            <p style="color:#94a3b8; margin:0; font-size:15px;">Download the individual package designated for your laptop. Each package has its own dedicated scripts, configuration, and pre-assigned port.</p>
          </div>
          ${cardsHtml}
          <div style="margin-top:24px; padding:16px; background:#0d1527; border-radius:8px; border:1px solid #1e293b; font-size:14px; color:#94a3b8;">
            <strong style="color:#f8fafc;">💡 Multi-Laptop Wi-Fi Setup:</strong>
            <ol style="margin:8px 0 0 16px; padding:0;">
              <li>Connect all teammates' laptops to the same Wi-Fi network or mobile hotspot.</li>
              <li>Run the Backend Server on one laptop (Port 5000).</li>
              <li>On the other laptops, run <code style="color:#38bdf8;">SET_BACKEND_IP.bat</code> and enter the server's IP address.</li>
              <li>Double-click the <code style="color:#34d399;">START_*.bat</code> script to run your assigned website!</li>
            </ol>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Dynamic file download handler
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const candidateDirs = [
    path.resolve(__dirname, '../../'),
    path.resolve(process.env.USERPROFILE || 'C:\\Users\\Lenovo', 'Downloads'),
    path.resolve(process.env.USERPROFILE || 'C:\\Users\\Lenovo', 'Desktop')
  ];
  for (const dir of candidateDirs) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      return res.download(filePath, filename);
    }
  }
  res.status(404).send(`File ${filename} not found.`);
});

// Serve frontend dist if built
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  console.log(`[Static] Serving frontend from: ${frontendDist}`);
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('================================================================');
  console.log(`🚨 GUARDIANBAND BACKEND ENGINE RUNNING ON PORT: ${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/health`);
  console.log(`   Frontend UI:  http://localhost:${PORT}`);
  console.log('================================================================');
});
