import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api, socket } from './services/api';
import type { Emergency, SystemStats } from './types';
import { EmergencyMap } from './components/EmergencyMap';
import { NetworkLauncher } from './components/NetworkLauncher';
import { audioAlert } from './utils/audioAlert';
import { 
  ShieldAlert, Siren, CheckCircle2, Navigation, Clock, User, 
  MapPin, Radio, Volume2, VolumeX, Layers, Sparkles, Play, Square, Send, Activity, Trash2,
  Heart, Battery
} from 'lucide-react';

export const App: React.FC = () => {
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 1240,
    totalDevices: 127,
    onlineDevices: 127,
    offlineDevices: 12,
    activeEmergencies: 2,
    resolvedEmergencies: 45,
    timestamp: new Date().toISOString()
  });

  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(audioAlert.isMuted());
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [newEmergencyAlert, setNewEmergencyAlert] = useState<string | null>(null);

  // Live Tracking Simulation States in Police Control Room
  const [isSimulatingTracking, setIsSimulatingTracking] = useState<boolean>(false);
  const [simulationStep, setSimulationStep] = useState<number>(0);
  const [trackingFeedback, setTrackingFeedback] = useState<string | null>(null);
  const policeStreamIntervalRef = useRef<number | null>(null);

  // Load initial emergencies & stats
  const loadData = async () => {
    try {
      const [statsData, emergenciesData] = await Promise.all([
        api.getStats(),
        api.getEmergencies()
      ]);
      setStats(statsData);
      setEmergencies(emergenciesData);

      if (emergenciesData.length > 0 && !selectedId) {
        setSelectedId(emergenciesData[0].emergencyId);
        setSelectedEmergency(emergenciesData[0]);
      }
    } catch (err) {
      console.error('Failed to load police data:', err);
    }
  };

  useEffect(() => {
    document.title = 'GuardianBand | Police Emergency Control Room';
    loadData();

    // Socket.IO real-time event listeners
    const handleNewEmergency = (payload: { emergency: Emergency }) => {
      console.log('🚨 POLICE EOC: New emergency received via real-time bus!', payload.emergency);

      // Play tactical audio chime
      audioAlert.playEmergencyChime();

      // Set visual flash alert banner
      setNewEmergencyAlert(`🚨 NEW VERIFIED SOS: ${payload.emergency.emergencyId} (${payload.emergency.userId})`);
      setTimeout(() => setNewEmergencyAlert(null), 8000);

      // Prepend to emergencies list
      setEmergencies((prev) => [payload.emergency, ...prev.filter(e => e.emergencyId !== payload.emergency.emergencyId)]);
      setSelectedId(payload.emergency.emergencyId);
      setSelectedEmergency(payload.emergency);

      // Update stat counters
      setStats((prev) => ({
        ...prev,
        activeEmergencies: prev.activeEmergencies + 1
      }));
    };

    const handleLocationUpdate = (payload: { emergencyId: string; location: { latitude: number; longitude: number; address?: string; timestamp: string } }) => {
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

      // If this is the currently selected emergency, update detail view too
      setSelectedEmergency((prev) => {
        if (prev && prev.emergencyId === payload.emergencyId) {
          const updatedHistory = [...(prev.locationHistory || []), payload.location];
          return {
            ...prev,
            latitude: payload.location.latitude,
            longitude: payload.location.longitude,
            address: payload.location.address || prev.address,
            locationHistory: updatedHistory,
            updatedAt: payload.location.timestamp
          };
        }
        return prev;
      });
    };

    const handleStatusChange = (payload: { emergency: Emergency }) => {
      setEmergencies((prev) => prev.map((e) => e.emergencyId === payload.emergency.emergencyId ? payload.emergency : e));
      setSelectedEmergency((prev) => prev?.emergencyId === payload.emergency.emergencyId ? payload.emergency : prev);
      api.getStats().then(setStats).catch(() => {});
    };

    socket.on('emergency:new', handleNewEmergency);
    socket.on('police:emergency:alert', handleNewEmergency);
    socket.on('emergency:location_update', handleLocationUpdate);
    socket.on('emergency:status_change', handleStatusChange);

    return () => {
      socket.off('emergency:new', handleNewEmergency);
      socket.off('police:emergency:alert', handleNewEmergency);
      socket.off('emergency:location_update', handleLocationUpdate);
      socket.off('emergency:status_change', handleStatusChange);
    };
  }, []);

  // Fetch full details whenever selectedId changes
  useEffect(() => {
    if (!selectedId) return;
    api.getEmergencyById(selectedId)
      .then(setSelectedEmergency)
      .catch((e) => console.warn('Could not fetch emergency details:', e));
  }, [selectedId]);

  // Handle status transitions (ACKNOWLEDGE -> DISPATCH -> RESOLVE)
  const handleTransitionStatus = async (nextStatus: 'ACKNOWLEDGED' | 'DISPATCHED' | 'RESOLVED') => {
    if (!selectedId) return;
    setIsActionLoading(true);
    try {
      const updated = await api.updateEmergencyStatus(selectedId, nextStatus);
      setSelectedEmergency(updated);
      setEmergencies((prev) => prev.map((e) => e.emergencyId === selectedId ? updated : e));
      const newStats = await api.getStats();
      setStats(newStats);
    } catch (err) {
      console.error('Failed to transition status:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (policeStreamIntervalRef.current) {
        clearInterval(policeStreamIntervalRef.current);
        policeStreamIntervalRef.current = null;
      }
    };
  }, []);

  const handleTestSiren = () => {
    audioAlert.unlock();
    audioAlert.testSpeakerSound();
  };

  const handleSendTestGpsPing = async () => {
    if (!selectedEmergency) {
      setTrackingFeedback('⚠️ No emergency selected to track.');
      setTimeout(() => setTrackingFeedback(null), 4000);
      return;
    }

    const baseLat = selectedEmergency.latitude || 10.9993;
    const baseLng = selectedEmergency.longitude || 77.0842;
    const nextStep = simulationStep + 1;
    setSimulationStep(nextStep);
    const newLat = Number((baseLat + (nextStep % 2 === 0 ? 0.00015 : -0.0001) * Math.sin(nextStep)).toFixed(5));
    const newLng = Number((baseLng + 0.00025 * (nextStep % 10)).toFixed(5));

    try {
      await api.deviceSendLocation({
        deviceId: selectedEmergency.deviceId,
        userId: selectedEmergency.userId,
        emergencyId: selectedEmergency.emergencyId,
        latitude: newLat,
        longitude: newLng,
        address: `Live Movement Ping #${nextStep} (KIT Campus / Sulur Highway)`
      });
      setTrackingFeedback(`✅ Live GPS Ping #${nextStep} sent: (${newLat}, ${newLng}). Marker updated on map!`);
      setTimeout(() => setTrackingFeedback(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTrackingFeedback(`❌ Tracking error: ${msg}`);
    }
  };

  const handleToggleSimulateTracking = () => {
    if (isSimulatingTracking) {
      if (policeStreamIntervalRef.current) {
        clearInterval(policeStreamIntervalRef.current);
        policeStreamIntervalRef.current = null;
      }
      setIsSimulatingTracking(false);
      setTrackingFeedback('⏹ Live tracking simulation paused.');
      setTimeout(() => setTrackingFeedback(null), 3000);
      return;
    }

    if (!selectedEmergency) {
      setTrackingFeedback('⚠️ Please select an incident first.');
      setTimeout(() => setTrackingFeedback(null), 3000);
      return;
    }

    setIsSimulatingTracking(true);
    setTrackingFeedback(`🛰️ Live GPS Streaming Active for ${selectedEmergency.emergencyId}! Sending pings every 3s...`);

    let step = simulationStep;
    const interval = window.setInterval(async () => {
      step += 1;
      setSimulationStep(step);
      const baseLat = selectedEmergency.latitude || 10.9993;
      const baseLng = selectedEmergency.longitude || 77.0842;
      const newLat = Number((baseLat + 0.00016 * Math.cos(step * 0.8)).toFixed(5));
      const newLng = Number((baseLng + 0.0002 * (step % 12)).toFixed(5));

      try {
        await api.deviceSendLocation({
          deviceId: selectedEmergency.deviceId,
          userId: selectedEmergency.userId,
          emergencyId: selectedEmergency.emergencyId,
          latitude: newLat,
          longitude: newLng,
          address: `Movement waypoint #${step} (Sulur Highway Road)`
        });
        setTrackingFeedback(`📡 Live Ping #${step} received: (${newLat}, ${newLng}) • Breadcrumb polyline drawing`);
      } catch (err) {
        console.warn('Simulation ping error:', err);
      }
    }, 3000);

    policeStreamIntervalRef.current = interval;
  };

  const handleClearTrail = async () => {
    if (!selectedEmergency) return;
    if (policeStreamIntervalRef.current) {
      clearInterval(policeStreamIntervalRef.current);
      policeStreamIntervalRef.current = null;
      setIsSimulatingTracking(false);
    }
    try {
      await api.clearEmergencyTrail(selectedEmergency.emergencyId);
      setSelectedEmergency((prev) => prev ? {
        ...prev,
        locationHistory: prev.latitude && prev.longitude ? [{
          latitude: prev.latitude,
          longitude: prev.longitude,
          timestamp: new Date().toISOString()
        }] : []
      } : null);
      setTrackingFeedback('🗑️ Breadcrumb trail reset to initial location pin.');
      setTimeout(() => setTrackingFeedback(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTrackingFeedback(`❌ Could not clear trail: ${msg}`);
    }
  };

  const activeEmergenciesList = useMemo(() => emergencies.map(e => ({
    emergencyId: e.emergencyId,
    latitude: e.latitude,
    longitude: e.longitude,
    priority: e.priority,
    userId: e.userId
  })), [emergencies]);

  const filteredEmergencies = emergencies.filter((emg) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'ACTIVE') return emg.status !== 'RESOLVED' && emg.status !== 'CANCELLED';
    if (filterStatus === 'RESOLVED') return emg.status === 'RESOLVED';
    return emg.status === filterStatus;
  });

  return (
    <div className="w-full min-h-screen bg-[#070b14] text-slate-100 p-3 md:p-6 space-y-4">

      {/* TOP HEADER: GUARDIANBAND POLICE CONTROL ROOM */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-800/90 pb-3 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-red-800 flex items-center justify-center shadow-lg shadow-rose-950/50 border border-rose-500/30">
            <Siren className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
                LIVE OPERATIONS
              </span>
              <span className="text-xs text-slate-400 font-mono">SECTOR 4 DISPATCH TERMINAL</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase">
              GUARDIANBAND POLICE CONTROL ROOM
            </h1>
          </div>
        </div>

        {/* Audio Alert Toggle & Live System Time */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTestSiren}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition cursor-pointer shadow-lg shadow-rose-950/50 border border-rose-500/40"
            title="Play dual-tone emergency tactical siren test sound through speaker"
          >
            <Volume2 className="w-4 h-4 text-white animate-pulse" />
            <span>🔊 TEST SIREN</span>
          </button>

          <button
            onClick={() => {
              audioAlert.unlock();
              const nextMuted = audioAlert.toggleMute();
              setIsAudioMuted(nextMuted);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition cursor-pointer ${
              isAudioMuted 
                ? 'bg-slate-900 border-slate-700 text-slate-400' 
                : 'bg-emerald-950/40 border-emerald-700/50 text-emerald-400'
            }`}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span>{isAudioMuted ? 'AUDIO MUTED' : 'CHIME ACTIVE'}</span>
          </button>

          <div className="bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>SYSTEM ACTIVE</span>
          </div>

          <NetworkLauncher currentSite="POLICE" />
        </div>
      </header>

      {/* NEW EMERGENCY TOAST ALERT BANNER */}
      {newEmergencyAlert && (
        <div className="bg-rose-600 border border-rose-400 text-white px-4 py-2.5 rounded-xl flex items-center justify-between shadow-2xl animate-pulse">
          <div className="flex items-center gap-2 text-sm font-bold tracking-wide">
            <ShieldAlert className="w-5 h-5 animate-spin" />
            <span>{newEmergencyAlert}</span>
          </div>
          <span className="text-xs font-mono bg-black/30 px-2 py-0.5 rounded">
            AUTOMATIC POLICE ESCALATION RECEIVED
          </span>
        </div>
      )}

      {/* TOP STAT METRIC COUNTERS (Exact ASCII layout specification) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* ACTIVE SOS */}
        <div className="bg-gradient-to-br from-rose-950/40 to-slate-900/90 border border-rose-800/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400">
              ACTIVE SOS
            </p>
            <p className="text-3xl font-black text-rose-500 font-mono mt-1">
              {String(stats.activeEmergencies).padStart(2, '0')}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-900/30 border border-rose-700/50 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* ONLINE DEVICES */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              ONLINE DEVICES
            </p>
            <p className="text-3xl font-black text-white font-mono mt-1">
              {stats.onlineDevices}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-emerald-400">
            <Radio className="w-6 h-6" />
          </div>
        </div>

        {/* TOTAL USERS */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              TOTAL USERS
            </p>
            <p className="text-3xl font-black text-white font-mono mt-1">
              {stats.totalUsers}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-cyan-400">
            <User className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* CENTER: LIVE EMERGENCY MAP & TRACKING CONTROLS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-300">
            <Layers className="w-4 h-4 text-cyan-400" />
            LIVE EMERGENCY MAP & INCIDENT RADAR
          </span>
          <span>CENTERED ON: {selectedEmergency ? selectedEmergency.emergencyId : 'ALL INCIDENTS'}</span>
        </div>

        {/* LIVE TRACKING CONTROLS HUD */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono shadow-md">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-400 font-bold">
              <Activity className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
              <span>LIVE TRACKING:</span>
              <span className="text-white font-bold">{selectedEmergency ? selectedEmergency.emergencyId : 'SELECT INCIDENT'}</span>
            </span>

            {isSimulatingTracking ? (
              <span className="flex items-center gap-1.5 text-emerald-400 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-800/40 text-[11px] font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>STREAMING PINGS ACTIVE (STEP {simulationStep})</span>
              </span>
            ) : (
              <span className="text-slate-400 text-[11px] hidden md:inline">
                {selectedEmergency?.locationHistory?.length || 1} breadcrumb ping(s) recorded
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Tracking Simulation Toggle */}
            <button
              onClick={handleToggleSimulateTracking}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow ${
                isSimulatingTracking
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/50'
              }`}
              title="Continuously stream movement waypoints every 3s to test live tracking"
            >
              {isSimulatingTracking ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSimulatingTracking ? 'Stop Tracking Stream' : 'Auto-Track Movement (3s)'}</span>
            </button>

            {/* Manual Ping */}
            <button
              onClick={handleSendTestGpsPing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer transition"
              title="Send a single location step ping to advance the marker on the map"
            >
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              <span>Send Ping</span>
            </button>

            {/* Clear Breadcrumb Trail */}
            <button
              onClick={handleClearTrail}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 text-xs font-medium cursor-pointer transition"
              title="Reset breadcrumb trail and stop active simulation"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear Trail</span>
            </button>
          </div>
        </div>

        {/* Live Feedback Toast */}
        {trackingFeedback && (
          <div className="bg-cyan-950/90 border border-cyan-800/90 px-3 py-1.5 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-2 shadow animate-fade-in">
            <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-spin" />
            <span>{trackingFeedback}</span>
          </div>
        )}

        <EmergencyMap
          latitude={selectedEmergency?.latitude ?? null}
          longitude={selectedEmergency?.longitude ?? null}
          address={selectedEmergency?.address}
          emergencyId={selectedEmergency?.emergencyId}
          userId={selectedEmergency?.userId}
          locationHistory={selectedEmergency?.locationHistory || []}
          allActiveEmergencies={activeEmergenciesList}
          onSelectEmergency={(id) => setSelectedId(id)}
          height="380px"
        />
      </div>

      {/* BOTTOM DUAL PANELS: ACTIVE EMERGENCIES (Left) + SELECTED EMERGENCY (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* ACTIVE EMERGENCIES LIST (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <h2 className="text-sm font-bold tracking-wider uppercase text-white font-mono">
                ACTIVE EMERGENCIES
              </h2>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-2 py-0.5 rounded cursor-pointer ${filterStatus === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'}`}
              >
                ALL
              </button>
              <button
                onClick={() => setFilterStatus('NEW')}
                className={`px-2 py-0.5 rounded cursor-pointer ${filterStatus === 'NEW' ? 'bg-rose-900 text-rose-200 font-bold' : 'text-slate-400'}`}
              >
                NEW
              </button>
              <button
                onClick={() => setFilterStatus('ACTIVE')}
                className={`px-2 py-0.5 rounded cursor-pointer ${filterStatus === 'ACTIVE' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'}`}
              >
                ACTIVE
              </button>
            </div>
          </div>

          {/* Cards List */}
          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            {filteredEmergencies.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                No emergencies match active filter.
              </div>
            ) : (
              filteredEmergencies.map((emg) => {
                const isSelected = emg.emergencyId === selectedId;
                const isNew = emg.status === 'NEW';

                return (
                  <div
                    key={emg.emergencyId}
                    onClick={() => setSelectedId(emg.emergencyId)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-cyan-500/80 shadow-lg shadow-cyan-950/20 ring-1 ring-cyan-500/40'
                        : isNew
                        ? 'bg-rose-950/30 border-rose-600/60 hover:bg-rose-950/50'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {isNew && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                        )}
                        <span className="font-mono font-bold text-sm text-white">
                          {emg.emergencyId}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          emg.priority === 'CRITICAL' ? 'bg-red-500 text-white' :
                          emg.priority === 'HIGH' ? 'bg-rose-900/60 text-rose-300 border border-rose-700/50' :
                          'bg-amber-900/50 text-amber-300'
                        }`}>
                          {emg.priority}
                        </span>
                      </div>

                      {/* Status badge */}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        emg.status === 'NEW' ? 'bg-rose-600 text-white animate-pulse' :
                        emg.status === 'ACKNOWLEDGED' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                        emg.status === 'DISPATCHED' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' :
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}>
                        {emg.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 flex items-center justify-between">
                      <span>User: <b className="text-white">{emg.user?.name || emg.userId}</b></span>
                      <span className="text-slate-400 font-mono text-[11px]">{emg.deviceId}</span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono truncate mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{emg.address || 'Resolving coordinates...'}</span>
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono mt-1.5 flex items-center justify-between">
                      <span>Verified: {new Date(emg.verificationTime || emg.triggerTime).toLocaleTimeString()}</span>
                      <span className="text-cyan-400 font-semibold">{emg.verificationMethod}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SELECTED EMERGENCY DETAIL VIEW (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-5">
          {!selectedEmergency ? (
            <div className="py-20 text-center text-slate-500 font-mono text-sm">
              Select an emergency from the left panel to inspect details and dispatch response.
            </div>
          ) : (
            <>
              {/* Emergency Card Header */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-black text-rose-500 flex items-center gap-1.5">
                      <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
                      🚨 SOS VERIFIED
                    </span>
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-800 text-slate-200 rounded">
                      {selectedEmergency.emergencyId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    Automatic Transfer Received: {new Date(selectedEmergency.createdAt).toLocaleString()}
                  </p>
                </div>

                {/* Status Progression Buttons (ACKNOWLEDGE -> DISPATCH -> RESOLVE) */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedEmergency.status === 'NEW' && (
                    <button
                      onClick={() => handleTransitionStatus('ACKNOWLEDGED')}
                      disabled={isActionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold font-mono rounded-lg transition cursor-pointer shadow"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ACKNOWLEDGE
                    </button>
                  )}

                  {(selectedEmergency.status === 'NEW' || selectedEmergency.status === 'ACKNOWLEDGED') && (
                    <button
                      onClick={() => handleTransitionStatus('DISPATCHED')}
                      disabled={isActionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold font-mono rounded-lg transition cursor-pointer shadow"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      DISPATCH UNIT
                    </button>
                  )}

                  {selectedEmergency.status === 'DISPATCHED' && (
                    <button
                      onClick={() => handleTransitionStatus('RESOLVED')}
                      disabled={isActionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono rounded-lg transition cursor-pointer shadow"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      RESOLVE INCIDENT
                    </button>
                  )}

                  {selectedEmergency.status === 'RESOLVED' && (
                    <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                      INCIDENT RESOLVED
                    </span>
                  )}
                </div>
              </div>

              {/* User & Location Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                {/* User Info */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-slate-300 font-bold border-b border-slate-800 pb-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span>USER & WEARABLE IDENTITY</span>
                  </div>
                  <div><span className="text-slate-500">Name:</span> <span className="text-white font-bold">{selectedEmergency.user?.name || selectedEmergency.userId}</span></div>
                  <div><span className="text-slate-500">User ID:</span> <span className="text-slate-300">{selectedEmergency.userId}</span></div>
                  <div><span className="text-slate-500">Device ID:</span> <span className="text-slate-300">{selectedEmergency.deviceId}</span></div>
                  {selectedEmergency.user?.phone && (
                    <div><span className="text-slate-500">Phone:</span> <span className="text-slate-300">{selectedEmergency.user.phone}</span></div>
                  )}
                  {selectedEmergency.user?.emergencyContact && (
                    <div className="pt-2 border-t border-slate-800/60 mt-1 space-y-0.5">
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <span>🛡️ Primary Guardian:</span>
                      </span>
                      <p className="text-white font-bold">
                        {selectedEmergency.user.emergencyContact.name} ({selectedEmergency.user.emergencyContact.relation})
                      </p>
                      <a 
                        href={`tel:${selectedEmergency.user.emergencyContact.phone}`} 
                        className="text-cyan-400 hover:text-cyan-300 underline font-mono text-[11px] block"
                        title="Click to dial emergency contact"
                      >
                        📞 {selectedEmergency.user.emergencyContact.phone}
                      </a>
                    </div>
                  )}
                  {selectedEmergency.user?.secondaryContact && (
                    <div className="pt-1.5 border-t border-slate-800/60 mt-1 space-y-0.5">
                      <span className="text-amber-400 font-bold">Secondary Contact:</span>
                      <p className="text-white font-medium">
                        {selectedEmergency.user.secondaryContact.name} ({selectedEmergency.user.secondaryContact.relation})
                      </p>
                      <a 
                        href={`tel:${selectedEmergency.user.secondaryContact.phone}`} 
                        className="text-cyan-400 hover:text-cyan-300 underline font-mono text-[11px] block"
                        title="Click to dial secondary contact"
                      >
                        📞 {selectedEmergency.user.secondaryContact.phone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Location Info */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-slate-300 font-bold border-b border-slate-800 pb-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span>COORDINATES & SECTOR</span>
                  </div>
                  <div><span className="text-slate-500">Latitude:</span> <span className="text-white font-bold">{selectedEmergency.latitude ?? 'UNAVAILABLE'}</span></div>
                  <div><span className="text-slate-500">Longitude:</span> <span className="text-white font-bold">{selectedEmergency.longitude ?? 'UNAVAILABLE'}</span></div>
                  <div><span className="text-slate-500">Tactical Address:</span> <span className="text-slate-200">{selectedEmergency.address || 'Kalaignar Karunanidhi Institute of Technology, Coimbatore'}</span></div>
                  <div><span className="text-slate-500">Trigger Time:</span> <span className="text-slate-300">{new Date(selectedEmergency.triggerTime).toLocaleTimeString()}</span></div>
                  <div><span className="text-slate-500">Verification Time:</span> <span className="text-slate-300">{new Date(selectedEmergency.verificationTime).toLocaleTimeString()}</span></div>
                  <div><span className="text-slate-500">Police Status:</span> <span className="text-amber-400 font-bold">{selectedEmergency.policeStatus}</span></div>
                </div>
              </div>

              {/* LIVE HEALTH & HARDWARE TELEMETRY HUD */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span>LIVE HARDWARE & BIOSENSOR TELEMETRY (MAX30102)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Alert Received: <b className="text-white">{new Date(selectedEmergency.createdAt).toLocaleTimeString()}</b>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Heart Rate */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase">Heart Rate</span>
                    <p className="text-base font-bold text-rose-400 flex items-center gap-1 mt-0.5">
                      <Heart className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                      <span>{selectedEmergency.heartRate || 112} BPM</span>
                    </p>
                  </div>

                  {/* SpO2 */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase">SpO2 Oxygen</span>
                    <p className="text-base font-bold text-cyan-300 flex items-center gap-1 mt-0.5">
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{selectedEmergency.spo2 || 96}%</span>
                    </p>
                  </div>

                  {/* Battery */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase">Wearer Battery</span>
                    <p className="text-base font-bold text-amber-300 flex items-center gap-1 mt-0.5">
                      <Battery className="w-3.5 h-3.5 text-amber-400" />
                      <span>{selectedEmergency.battery ?? selectedEmergency.device?.battery ?? 84}%</span>
                    </p>
                  </div>

                  {/* Live Tracking URL Link */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase">Live Tracking URL</span>
                    <a
                      href={`http://localhost:5175/?id=${selectedEmergency.emergencyId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-cyan-400 hover:text-cyan-300 underline block mt-1 truncate"
                      title="Open Live GuardianBand Tracker"
                    >
                      Open Live Portal (Port 5175) ↗
                    </a>
                  </div>
                </div>
              </div>

              {/* AI AUTOMATION SUMMARY PANEL */}
              <div className="bg-gradient-to-r from-purple-950/30 via-slate-900 to-indigo-950/30 border border-purple-800/40 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-purple-300 font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    AI AUTOMATION LAYER REPORT
                  </span>
                  <span className="text-[10px] text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/50">
                    STATUS: {selectedEmergency.aiReport?.aiStatus || selectedEmergency.aiStatus || 'COMPLETED'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  {selectedEmergency.aiReport?.summary || 
                    `Emergency verified via 15-second timeout window. Automated police routing completed. Priority assigned: ${selectedEmergency.priority}.`}
                </p>
                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800">
                  <span>Routing: <b className="text-emerald-400">AUTOMATIC_TRANSFER_COMPLETE</b></span>
                  <span>•</span>
                  <span>Escalation: <b className="text-purple-300">POLICE CONTROL ROOM</b></span>
                </div>
              </div>

              {/* EVENT AUDIT TIMELINE (Exact Section 14 Specification) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>EVENT TIMELINE</span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 font-mono text-xs">
                  {selectedEmergency.timeline && selectedEmergency.timeline.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3 py-0.5">
                      <span className="text-[11px] text-slate-500 shrink-0">
                        {new Date(item.time).toLocaleTimeString()}
                      </span>
                      <span className={`text-xs ${
                        item.event.includes('🚨') ? 'text-rose-400 font-bold' :
                        item.event.includes('Police') ? 'text-cyan-300 font-semibold' :
                        item.event.includes('AI') ? 'text-purple-300' :
                        'text-slate-300'
                      }`}>
                        {item.event}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

      </div>

    </div>
  );
};

export default App;
