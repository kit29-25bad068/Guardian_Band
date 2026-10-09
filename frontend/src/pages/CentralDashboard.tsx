import React, { useState, useEffect } from 'react';
import { api, socket } from '../services/api';
import type { Device, Emergency, SystemStats, AuditLog, DeviceCommand, User } from '../types';
import { EmergencyMap } from '../components/EmergencyMap';
import { NetworkLauncher } from '../components/NetworkLauncher';
import { 
  Cpu, Bell, ShieldAlert, Battery, MapPin, 
  Play, Square, RefreshCw, RotateCcw, AlertTriangle, 
  CheckCircle2, Heart, Activity, Zap, ExternalLink, Shield
} from 'lucide-react';

export const CentralDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('GB-1024');
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());
  const [commandFeedback, setCommandFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isExecutingCommand, setIsExecutingCommand] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Selected device reference
  const selectedDevice = devices.find(d => d.deviceId === selectedDeviceId) || devices[0];

  // Active emergency for selected device
  const activeEmergency = emergencies.find(e => 
    (e.deviceId === selectedDeviceId || e.userId === selectedDevice?.userId) && 
    e.status !== 'RESOLVED' && e.status !== 'CANCELLED'
  );

  const loadCentralData = async () => {
    try {
      const [s, d, e, logs] = await Promise.all([
        api.getStats(),
        api.getDevices(),
        api.getEmergencies(),
        api.getAuditLogs()
      ]);
      setStats(s);
      setDevices(d);
      setEmergencies(e);
      setAuditLogs(logs);
      setLastUpdated(new Date().toLocaleTimeString());

      if (d.length > 0 && !devices.some(x => x.deviceId === selectedDeviceId)) {
        setSelectedDeviceId(d[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to load central telemetry:', err);
    }
  };

  useEffect(() => {
    document.title = 'GuardianBand | Central Control Dashboard';
    loadCentralData();

    // Fetch user for selected device
    if (selectedDevice?.userId) {
      api.getUser(selectedDevice.userId).then(setSelectedUser).catch(() => {});
    }

    // Real-time socket updates
    const onNewEmergency = () => {
      loadCentralData();
    };

    const onLocation = (payload: { emergencyId: string; location: any }) => {
      setEmergencies((prev) => prev.map((e) => {
        if (e.emergencyId === payload.emergencyId) {
          const updatedHistory = [...(e.locationHistory || []), payload.location];
          return {
            ...e,
            latitude: payload.location.latitude,
            longitude: payload.location.longitude,
            address: payload.location.address || e.address,
            locationHistory: updatedHistory,
            updatedAt: payload.location.timestamp
          };
        }
        return e;
      }));

      // Update corresponding device in table
      setDevices((prev) => prev.map((d) => {
        const matchingEmg = emergencies.find(em => em.emergencyId === payload.emergencyId);
        if (matchingEmg && d.deviceId === matchingEmg.deviceId) {
          return {
            ...d,
            latitude: payload.location.latitude,
            longitude: payload.location.longitude,
            address: payload.location.address || d.address,
            lastUpdated: payload.location.timestamp
          };
        }
        return d;
      }));
    };

    const onStatusChange = () => {
      loadCentralData();
    };

    const onDeviceTelemetry = (payload: { device: Device }) => {
      setDevices((prev) => {
        const exists = prev.some(d => d.deviceId === payload.device.deviceId);
        if (exists) {
          return prev.map(d => d.deviceId === payload.device.deviceId ? payload.device : d);
        }
        return [...prev, payload.device];
      });
      api.getStats().then(setStats).catch(() => {});
    };

    socket.on('emergency:new', onNewEmergency);
    socket.on('emergency:location_update', onLocation);
    socket.on('emergency:status_change', onStatusChange);
    socket.on('device:telemetry', onDeviceTelemetry);

    return () => {
      socket.off('emergency:new', onNewEmergency);
      socket.off('emergency:location_update', onLocation);
      socket.off('emergency:status_change', onStatusChange);
      socket.off('device:telemetry', onDeviceTelemetry);
    };
  }, [selectedDeviceId, selectedDevice?.userId]);

  // Command Dispatcher: Central Dashboard -> Node.js -> Device Simulator
  const handleSendCommand = async (command: DeviceCommand, params?: any) => {
    if (!selectedDevice) return;
    setIsExecutingCommand(true);
    setCommandFeedback({
      message: `Dispatching [${command}] to device ${selectedDevice.deviceId} via Node.js Socket.IO bus...`,
      type: 'info'
    });

    try {
      await api.sendCommandToDevice(selectedDevice.deviceId, command, params);
      setCommandFeedback({
        message: `✅ Command [${command}] executed! Device acknowledged.`,
        type: 'success'
      });
      setTimeout(() => setCommandFeedback(null), 4500);
      loadCentralData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCommandFeedback({
        message: `❌ Command failed: ${msg}`,
        type: 'error'
      });
      setTimeout(() => setCommandFeedback(null), 5000);
    } finally {
      setIsExecutingCommand(false);
    }
  };

  const handleResetDevice = async () => {
    if (!selectedDevice) return;
    setIsExecutingCommand(true);
    try {
      await api.resetDevice(selectedDevice.deviceId);
      setCommandFeedback({
        message: `🔄 Device ${selectedDevice.deviceId} reset to NORMAL. All states cleared.`,
        type: 'success'
      });
      setTimeout(() => setCommandFeedback(null), 4000);
      loadCentralData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCommandFeedback({
        message: `❌ Reset failed: ${msg}`,
        type: 'error'
      });
    } finally {
      setIsExecutingCommand(false);
    }
  };

  const handleOpenSimulatorPopout = () => {
    window.open(
      '/?view=SIMULATOR', 
      'GuardianBand_DeviceSimulator_Window', 
      'width=540,height=960,resizable=yes,scrollbars=yes,status=no,location=no'
    );
  };

  // Determine current map coordinates for monitored device
  const mapLat = activeEmergency?.latitude ?? selectedDevice?.latitude ?? 10.9993;
  const mapLng = activeEmergency?.longitude ?? selectedDevice?.longitude ?? 77.0842;
  const mapAddress = activeEmergency?.address ?? selectedDevice?.address ?? 'Kalaignar Karunanidhi Institute of Technology, Coimbatore';

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* =================================================================== */}
      {/* 1. TOP HEADER & INTEGRATED ARCHITECTURE STATUS BAR                  */}
      {/* =================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              CENTRAL MONITORING & CONTROL HUB
            </span>
            <span className="text-xs text-slate-400 font-mono">
              INTEGRATED REAL-TIME EMERGENCY ARCHITECTURE
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">
            Central Control Dashboard
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Architecture: <b className="text-purple-400">Device Simulator (ESP32 Model)</b> ⟷ <b className="text-cyan-400">Node.js + Socket.IO</b> ⟷ <b className="text-rose-400">Police EOC</b>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Popout Simulator Button */}
          <button
            onClick={handleOpenSimulatorPopout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/50 hover:bg-purple-800 border border-purple-600/50 text-purple-200 text-xs font-mono font-bold transition cursor-pointer shadow"
            title="Open the Device Simulator in a separate standalone window side-by-side"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>OPEN SIMULATOR (SEPARATE WINDOW)</span>
          </button>

          <button
            onClick={loadCentralData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono cursor-pointer transition border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>REFRESH</span>
          </button>

          <NetworkLauncher currentSite="CENTRAL" />
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. REAL-TIME CONNECTION ARCHITECTURE LINK INDICATORS                */}
      {/* =================================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Device Simulator Link */}
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${selectedDevice?.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
              <span className="text-slate-300 font-bold">Device Simulator:</span>
              <span className={selectedDevice?.status === 'ONLINE' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                {selectedDevice?.deviceId || 'GB-1024'} ({selectedDevice?.status || 'ONLINE'})
              </span>
            </div>

            <span className="text-slate-700 hidden md:inline">|</span>

            {/* Node.js Backend Link */}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300 font-bold">Node.js Backend:</span>
              <span className="text-emerald-400 font-bold">PORT 5000 (HEALTHY)</span>
            </div>

            <span className="text-slate-700 hidden md:inline">|</span>

            {/* Socket.IO Real-time */}
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${socket.connected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`}></span>
              <span className="text-slate-300 font-bold">Real-time Bus:</span>
              <span className={socket.connected ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                {socket.connected ? 'SOCKET.IO CONNECTED' : 'RECONNECTING'}
              </span>
            </div>
          </div>

          <div className="text-slate-500 text-[11px]">
            LAST SYNC: <span className="text-slate-300 font-bold">{lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* EMERGENCY ACTIVE ALERT BANNER */}
      {activeEmergency && (
        <div className="bg-gradient-to-r from-rose-950 via-red-900 to-rose-950 border-2 border-rose-500 text-white p-4 rounded-xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-lg">
              <ShieldAlert className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black font-mono tracking-wider text-rose-200">
                  🚨 VERIFIED EMERGENCY IN PROGRESS
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-black/50 text-white border border-rose-400/50">
                  {activeEmergency.emergencyId}
                </span>
              </div>
              <p className="text-xs text-rose-200 font-mono mt-0.5">
                Wearer: <b>{selectedUser?.name || activeEmergency.userId}</b> • Tracking: <b className="text-emerald-300">ACTIVE</b> • Escalation: <b className="text-cyan-300">SENT TO POLICE CONTROL ROOM</b>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto font-mono text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-black/40 border border-rose-400/60 text-rose-200 font-bold">
              POLICE STATUS: {activeEmergency.policeStatus}
            </span>
          </div>
        </div>
      )}

      {/* FEEDBACK TOAST FOR DASHBOARD COMMANDS */}
      {commandFeedback && (
        <div className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between transition ${
          commandFeedback.type === 'success' 
            ? 'bg-emerald-950/70 border-emerald-500/80 text-emerald-200' 
            : commandFeedback.type === 'error'
            ? 'bg-rose-950/70 border-rose-500/80 text-rose-200'
            : 'bg-cyan-950/70 border-cyan-500/80 text-cyan-200'
        }`}>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 animate-bounce" />
            <span>{commandFeedback.message}</span>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. CORE 2-COLUMN LAYOUT:                                            */}
      {/* LEFT (7 Cols): MONITORED DEVICE TELEMETRY + LIVE SENSOR DATA        */}
      {/* RIGHT (5 Cols): REMOTE DEVICE CONTROL CENTER (DASHBOARD -> DEVICE) */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT PANEL: MONITORED WEARABLE CARD & SENSOR TELEMETRY (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <div>
                <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                  Monitored GuardianBand Telemetry
                </h2>
                <p className="text-[11px] text-slate-400 font-mono">
                  Real-time synchronization with Wearer Hardware
                </p>
              </div>
            </div>

            {/* Device Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Device:</span>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white font-mono text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.deviceId} - {d.status} ({d.source || 'SIMULATOR'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DEVICE STATUS & IDENTITY METRICS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            
            {/* Device ID & User */}
            <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Wearer ID</span>
              <p className="text-sm font-bold text-white truncate">{selectedUser?.name || 'Priya Sharma'}</p>
              <p className="text-[10px] text-slate-400">{selectedDevice?.deviceId || 'GB-1024'}</p>
            </div>

            {/* Connection & Source */}
            <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Hardware Link</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${selectedDevice?.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                <span className={`text-xs font-bold ${selectedDevice?.status === 'ONLINE' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {selectedDevice?.status || 'ONLINE'}
                </span>
              </div>
              <p className="text-[10px] text-purple-400 truncate">{selectedDevice?.source || 'SIMULATOR'}</p>
            </div>

            {/* Battery Level */}
            <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Battery</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Battery className={`w-4 h-4 ${(selectedDevice?.battery || 84) < 20 ? 'text-rose-500' : (selectedDevice?.battery || 84) < 50 ? 'text-amber-400' : 'text-emerald-400'}`} />
                <span className="text-sm font-bold text-white">{selectedDevice?.battery ?? 84}%</span>
              </div>
              <p className="text-[10px] text-slate-500">LiPo 3.7V</p>
            </div>

            {/* Current State & Tracking */}
            <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Current State</span>
              <p className={`text-xs font-bold truncate ${
                activeEmergency ? 'text-rose-400 animate-pulse' :
                selectedDevice?.emergencyState === 'VERIFIED_EMERGENCY' ? 'text-rose-400' :
                selectedDevice?.emergencyState === 'VERIFYING' ? 'text-amber-400' :
                'text-emerald-400'
              }`}>
                {activeEmergency ? 'VERIFIED EMERGENCY' : selectedDevice?.emergencyState || 'NORMAL'}
              </p>
              <p className="text-[10px] text-cyan-400">
                Tracking: <b className="text-white">{selectedDevice?.trackingStatus || 'IDLE'}</b>
              </p>
            </div>

          </div>

          {/* LIVE HEALTH DATA (MAX30102 SENSOR TELEMETRY) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Live Health Data (MAX30102 Biosensor Telemetry)</span>
              </span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active Sensor Stream</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Heart Rate Card */}
              <div className="p-3.5 rounded-lg bg-gradient-to-br from-rose-950/30 to-slate-900 border border-rose-800/40 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5 uppercase">
                    <Heart className="w-4 h-4 text-rose-500 animate-pulse" />
                    <span>Heart Rate</span>
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-white font-mono">
                      {selectedDevice?.heartRate || 78}
                    </span>
                    <span className="text-xs text-rose-400 font-bold">BPM</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {(selectedDevice?.heartRate || 78) > 110 ? '⚠️ Tachycardia / High Distress' : 'Normal Resting Rhythm'}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-700/60 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-rose-400 animate-pulse" />
                </div>
              </div>

              {/* SpO2 Blood Oxygen Card */}
              <div className="p-3.5 rounded-lg bg-gradient-to-br from-cyan-950/30 to-slate-900 border border-cyan-800/40 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5 uppercase">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span>Blood Oxygen (SpO2)</span>
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-white font-mono">
                      {selectedDevice?.spo2 || 98}
                    </span>
                    <span className="text-xs text-cyan-400 font-bold">%</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {(selectedDevice?.spo2 || 98) < 92 ? '⚠️ Hypoxia Alert' : 'Normal Saturation (95-100%)'}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-full bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
            </div>
          </div>

          {/* EMERGENCY STATUS DETAILS (IF ACTIVE) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>EMERGENCY & ESCALATION STATUS</span>
              </span>
              <span className="text-[10px] text-slate-500">
                {activeEmergency ? activeEmergency.emergencyId : 'STANDBY'}
              </span>
            </div>

            {activeEmergency ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div><span className="text-slate-500">Trigger Time:</span> <p className="text-white font-medium">{new Date(activeEmergency.triggerTime).toLocaleTimeString()}</p></div>
                <div><span className="text-slate-500">Verified Time:</span> <p className="text-white font-medium">{new Date(activeEmergency.verificationTime).toLocaleTimeString()}</p></div>
                <div><span className="text-slate-500">Verification:</span> <p className="text-cyan-300 font-medium">{activeEmergency.verificationMethod}</p></div>
                <div><span className="text-slate-500">Priority:</span> <p className="text-rose-400 font-bold">{activeEmergency.priority}</p></div>
                <div><span className="text-slate-500">Police Escalation:</span> <p className="text-emerald-400 font-bold">SENT</p></div>
                <div><span className="text-slate-500">Tracking:</span> <p className="text-cyan-400 font-bold">{activeEmergency.status}</p></div>
              </div>
            ) : (
              <p className="text-slate-500 text-[11px]">
                No active verified distress event for {selectedDevice?.deviceId}. System is monitoring health telemetry and standby commands.
              </p>
            )}
          </div>

        </div>

        {/* =================================================================== */}
        {/* RIGHT PANEL: DASHBOARD -> SIMULATOR REMOTE CONTROL BENCH (5 Cols)   */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg">
          
          <div className="border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                Remote Device Control Bench
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Dispatches live commands to <b className="text-cyan-400">{selectedDevice?.deviceId}</b> via Node.js
            </p>
          </div>

          {/* Interactive Command Buttons */}
          <div className="space-y-3 font-mono text-xs">
            
            {/* 1. Location Request */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition">
              <div>
                <p className="text-white font-bold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Request Location Ping</span>
                </p>
                <p className="text-[10px] text-slate-400">Pings current GPS coordinates immediately</p>
              </div>
              <button
                onClick={() => handleSendCommand('REQUEST_LOCATION')}
                disabled={isExecutingCommand}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer transition shadow"
              >
                REQUEST
              </button>
            </div>

            {/* 2. Start Live Tracking */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition">
              <div>
                <p className="text-white font-bold flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Start Live Tracking</span>
                </p>
                <p className="text-[10px] text-slate-400">Streams GPS breadcrumb pings every 3s</p>
              </div>
              <button
                onClick={() => handleSendCommand('START_TRACKING')}
                disabled={isExecutingCommand || selectedDevice?.trackingStatus === 'ACTIVE'}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold cursor-pointer transition shadow"
              >
                START
              </button>
            </div>

            {/* 3. Stop Tracking */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition">
              <div>
                <p className="text-white font-bold flex items-center gap-1.5">
                  <Square className="w-3.5 h-3.5 text-amber-400" />
                  <span>Stop Tracking</span>
                </p>
                <p className="text-[10px] text-slate-400">Pauses continuous breadcrumb streaming</p>
              </div>
              <button
                onClick={() => handleSendCommand('STOP_TRACKING')}
                disabled={isExecutingCommand || selectedDevice?.trackingStatus === 'IDLE'}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold cursor-pointer transition shadow"
              >
                STOP
              </button>
            </div>

            {/* 4. Remote Test SOS */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition">
              <div>
                <p className="text-white font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Test SOS Activation</span>
                </p>
                <p className="text-[10px] text-slate-400">Initiates 15s verification countdown on band</p>
              </div>
              <button
                onClick={() => handleSendCommand('TEST_SOS')}
                disabled={isExecutingCommand}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition shadow"
              >
                TEST SOS
              </button>
            </div>

            {/* 5. Cancel Test Emergency */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition">
              <div>
                <p className="text-white font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cancel Emergency</span>
                </p>
                <p className="text-[10px] text-slate-400">Cancels countdown and returns to NORMAL</p>
              </div>
              <button
                onClick={() => handleSendCommand('CANCEL_TEST_EMERGENCY')}
                disabled={isExecutingCommand}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer transition border border-slate-700"
              >
                CANCEL
              </button>
            </div>

            {/* 6. Reset Device */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition">
              <div>
                <p className="text-white font-bold flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                  <span>Reset Device</span>
                </p>
                <p className="text-[10px] text-slate-400">Restores device back to clean standby NORMAL</p>
              </div>
              <button
                onClick={handleResetDevice}
                disabled={isExecutingCommand}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer transition shadow"
              >
                RESET
              </button>
            </div>

          </div>

          {/* Bi-directional Flow Callout */}
          <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <span className="text-cyan-400 font-bold flex items-center gap-1">
              <span>⚡ Bi-Directional Socket.IO Integration:</span>
            </span>
            <p>
              Commands clicked here transmit over WebSocket to Node.js, which pushes them directly into the Device Simulator. The simulator reacts instantly, changing state and returning live telemetry.
            </p>
          </div>

        </div>

      </div>

      {/* =================================================================== */}
      {/* 4. LIVE LOCATION MAP RADAR PANEL                                    */}
      {/* =================================================================== */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
              Live Location & Movement Radar ({selectedDevice?.deviceId || 'GB-1024'})
            </h2>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{selectedDevice?.trackingStatus === 'ACTIVE' ? 'STREAMING ACTIVE' : 'STANDBY'}</span>
            </span>
            <span>•</span>
            <span>Lat: <b className="text-white">{Number(mapLat).toFixed(5)}°</b></span>
            <span>Lng: <b className="text-white">{Number(mapLng).toFixed(5)}°</b></span>
          </div>
        </div>

        {/* Sector Address Banner */}
        <div className="flex items-center justify-between bg-slate-950/70 border border-slate-800 p-2.5 rounded-lg text-xs font-mono">
          <span className="text-slate-400 truncate">
            📍 Sector: <b className="text-slate-200">{mapAddress}</b>
          </span>
          <a
            href={`/portal?id=${activeEmergency?.emergencyId || 'EMG-2026-001'}`}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline font-mono text-[11px] shrink-0 ml-2"
          >
            Live Tracking URL ↗
          </a>
        </div>

        {/* Interactive Map Component */}
        <div className="rounded-xl overflow-hidden border border-slate-800 shadow-inner">
          <EmergencyMap
            latitude={mapLat}
            longitude={mapLng}
            address={mapAddress}
            emergencyId={activeEmergency?.emergencyId}
            userId={selectedDevice?.userId}
            locationHistory={activeEmergency?.locationHistory || []}
            height="360px"
          />
        </div>
      </div>

      {/* =================================================================== */}
      {/* 5. METRICS STAT COUNTERS ROW                                        */}
      {/* =================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
          <p className="text-[11px] uppercase text-slate-400">Total Users</p>
          <p className="text-2xl font-black text-white mt-1">{stats?.totalUsers ?? '...'}</p>
          <p className="text-[10px] text-emerald-400 mt-1">Profiles</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
          <p className="text-[11px] uppercase text-slate-400">Active Devices</p>
          <p className="text-2xl font-black text-cyan-400 mt-1">{stats?.totalDevices ?? '...'}</p>
          <p className="text-[10px] text-slate-500 mt-1">Paired Bands</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
          <p className="text-[11px] uppercase text-slate-400">Online</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats?.onlineDevices ?? '...'}</p>
          <p className="text-[10px] text-emerald-400 mt-1">Heartbeat</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
          <p className="text-[11px] uppercase text-slate-400">Offline</p>
          <p className="text-2xl font-black text-slate-400 mt-1">{stats?.offlineDevices ?? '...'}</p>
          <p className="text-[10px] text-rose-400 mt-1">Check Link</p>
        </div>

        <div className="bg-gradient-to-br from-rose-950/40 to-slate-900/90 border border-rose-800/60 rounded-xl p-3.5">
          <p className="text-[11px] uppercase text-rose-400">Active SOS</p>
          <p className="text-2xl font-black text-rose-500 mt-1">{stats?.activeEmergencies ?? '...'}</p>
          <p className="text-[10px] text-rose-400 mt-1 animate-pulse">Escalated</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
          <p className="text-[11px] uppercase text-slate-400">Resolved</p>
          <p className="text-2xl font-black text-white mt-1">{stats?.resolvedEmergencies ?? '...'}</p>
          <p className="text-[10px] text-slate-400 mt-1">Safe Closure</p>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 6. FLEET DEVICE TABLE & REAL-TIME AUDIT LOG FEED                    */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* FLEET TABLE (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                Fleet Health & Hardware Telemetry
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">{devices.length} Devices Registered</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Device ID</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Battery</th>
                  <th className="py-2.5 px-3">Heart Rate</th>
                  <th className="py-2.5 px-3">SpO2</th>
                  <th className="py-2.5 px-3">Tracking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {devices.map((d) => (
                  <tr 
                    key={d.deviceId} 
                    onClick={() => setSelectedDeviceId(d.deviceId)}
                    className={`hover:bg-slate-800/40 transition cursor-pointer ${
                      d.deviceId === selectedDeviceId ? 'bg-cyan-950/30' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-bold text-white flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${d.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                      {d.deviceId}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] text-purple-400 px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40">
                        {d.source || 'SIMULATOR'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.status === 'ONLINE' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <Battery className={`w-3.5 h-3.5 ${d.battery < 20 ? 'text-rose-500 animate-pulse' : d.battery < 50 ? 'text-amber-400' : 'text-emerald-400'}`} />
                        <span className="font-bold text-slate-200">{d.battery}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-rose-400 font-bold">{d.heartRate || 78} BPM</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-cyan-400 font-bold">{d.spo2 || 98}%</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-bold ${d.trackingStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {d.trackingStatus || 'IDLE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AUDIT LOG & COMMAND FEED (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                Real-Time Command & Audit Feed
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">Live Bus</span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono py-8 text-center">No system events logged.</p>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 font-mono text-xs space-y-1 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      log.severity === 'CRITICAL' ? 'bg-red-500 text-white' :
                      log.severity === 'HIGH' ? 'bg-rose-900/80 text-rose-200' :
                      log.severity === 'WARNING' ? 'bg-amber-900/80 text-amber-200' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {log.eventType}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {log.details}
                  </p>
                  {(log.userId || log.deviceId) && (
                    <div className="text-[10px] text-slate-500 pt-1 flex items-center gap-2">
                      {log.userId && <span>User: {log.userId}</span>}
                      {log.deviceId && <span>Device: {log.deviceId}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default CentralDashboard;
