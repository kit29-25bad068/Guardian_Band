import React, { useState, useEffect, useRef } from 'react';
import { api, socket } from '../services/api';
import type { User, DeviceCommand } from '../types';
import { 
  Battery, ShieldAlert, CheckCircle2, 
  MapPin, Play, Square, Send, RefreshCw, 
  Shield, Check, Heart, Activity, 
  ExternalLink, Zap, RotateCcw, Terminal
} from 'lucide-react';
import { reverseGeocode } from '../utils/geoUtils';
import { NetworkLauncher } from '../components/NetworkLauncher';

interface DeviceSimulatorProps {
  onSOSDispatched?: () => void;
}

export const DeviceSimulator: React.FC<DeviceSimulatorProps> = ({ onSOSDispatched }) => {
  // Device Identity & Architecture Mode
  const [deviceId] = useState('GB-1024');
  const [userId] = useState('USER-1024');
  const [token] = useState('tok_gb1024_secure');
  const [source] = useState<'SIMULATOR' | 'PHYSICAL_DEVICE'>('SIMULATOR');

  // Wearable Hardware Telemetry
  const [battery, setBattery] = useState(84);
  const [gpsAvailable, setGpsAvailable] = useState(true);
  const [cellularConnected, setCellularConnected] = useState(true);
  const [heartRate, setHeartRate] = useState(78); // MAX30102 simulated
  const [spo2, setSpo2] = useState(98); // MAX30102 simulated
  const [trackingStatus, setTrackingStatus] = useState<'IDLE' | 'ACTIVE'>('IDLE');

  // GPS Coordinates & Movement Simulation
  const [latitude, setLatitude] = useState(10.9993);
  const [longitude, setLongitude] = useState(77.0842);
  const [isStreamingGps, setIsStreamingGps] = useState(false);
  const [streamingPingCount, setStreamingPingCount] = useState(0);
  const [gpsStep, setGpsStep] = useState(0);

  // GPS Location Mode: 'REAL_BROWSER' | 'SIMULATED_LOCAL' | 'CUSTOM'
  const [locationSource, setLocationSource] = useState<'REAL_BROWSER' | 'SIMULATED_LOCAL' | 'CUSTOM'>('REAL_BROWSER');
  const [realAddress, setRealAddress] = useState<string>('Detecting live browser GPS...');
  const [realAccuracy, setRealAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const customAddress = '';
  const [registeredUser, setRegisteredUser] = useState<User | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // SOS State Machine:
  // IDLE -> STAGE_1_HOLDING -> STAGE_1_DONE -> STAGE_2_HOLDING -> COUNTDOWN_15S -> VERIFIED -> CANCELLED
  const [sosState, setSosState] = useState<'IDLE' | 'STAGE_1_HOLDING' | 'STAGE_1_DONE' | 'STAGE_2_HOLDING' | 'COUNTDOWN_15S' | 'VERIFIED' | 'CANCELLED'>('IDLE');
  const [countdown, setCountdown] = useState(15);
  const [confirmCountdown, setConfirmCountdown] = useState<number>(5);
  const [activeEmergencyId, setActiveEmergencyId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Wearer Normal. Standby monitoring.');
  const [lastReceivedCommand, setLastReceivedCommand] = useState<string | null>(null);
  const [commandFeedbackFlash, setCommandFeedbackFlash] = useState<string | null>(null);

  // Timestamps and intervals
  const holdIntervalRef = useRef<number | null>(null);
  const stage1TimeoutRef = useRef<number | null>(null);
  const confirmIntervalRef = useRef<number | null>(null);
  const lastPressTimeRef = useRef<number>(0);
  const countdownIntervalRef = useRef<number | null>(null);
  const gpsStreamIntervalRef = useRef<number | null>(null);

  // Simulated walking route waypoints (KIT Campus -> Kannampalayam -> Sulur)
  const routeWaypoints = [
    { lat: 10.9993, lng: 77.0842, addr: "KIT Campus, Main Quad" },
    { lat: 10.9982, lng: 77.0855, addr: "Kannampalayam West Junction" },
    { lat: 10.9970, lng: 77.0872, addr: "Kannampalayam Bus Stop" },
    { lat: 10.9955, lng: 77.0901, addr: "Trichy Road Access" },
    { lat: 10.9938, lng: 77.0945, addr: "Sulur Junction Hub" },
    { lat: 11.0010, lng: 77.0820, addr: "KIT Campus North Gate" }
  ];

  // Request browser GPS
  const requestRealLocation = (silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) setStatusMessage('⚠️ Browser Geolocation is not supported on this device/browser.');
      return;
    }

    setIsLocating(true);
    if (!silent) setStatusMessage('Requesting live high-precision browser GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy);

        setLatitude(lat);
        setLongitude(lng);
        setRealAccuracy(acc);
        setLocationSource('REAL_BROWSER');
        setIsLocating(false);

        const addr = await reverseGeocode(lat, lng);
        setRealAddress(addr);
        setStatusMessage(`📍 High-precision GPS locked: ${addr} (±${acc}m accuracy).`);

        // Synchronize with backend
        api.deviceSendLocation({
          deviceId,
          userId,
          latitude: lat,
          longitude: lng,
          address: addr,
          heartRate,
          spo2,
          token
        }).catch(() => {});
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error in simulator:', err);
        if (!silent) {
          setStatusMessage(`⚠️ Live location permission denied/unavailable: ${err.message}.`);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSelectPlace = (place: { name: string; latitude: number; longitude: number }) => {
    setLatitude(place.latitude);
    setLongitude(place.longitude);
    setRealAddress(place.name);
    setLocationSource('REAL_BROWSER');
    setStatusMessage(`📍 Location pinned to: ${place.name} (${place.latitude.toFixed(5)}°, ${place.longitude.toFixed(5)}°)`);

    api.deviceSendLocation({
      deviceId,
      userId,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.name,
      heartRate,
      spo2,
      token
    }).catch(() => {});
  };

  // Sync health telemetry changes with backend
  const handleUpdateHealthTelemetry = async (newHR: number, newSpO2: number) => {
    setHeartRate(newHR);
    setSpo2(newSpO2);
    try {
      await api.deviceUpdateTelemetry({
        deviceId,
        heartRate: newHR,
        spo2: newSpO2,
        battery,
        source: 'SIMULATOR',
        trackingStatus,
        emergencyState: sosState === 'VERIFIED' ? 'VERIFIED_EMERGENCY' : sosState === 'COUNTDOWN_15S' ? 'VERIFYING' : 'NORMAL'
      });
      setStatusMessage(`💓 Sensor Telemetry synced: HR ${newHR} BPM, SpO2 ${newSpO2}%`);
    } catch (err) {
      console.warn('Telemetry sync error:', err);
    }
  };

  // Initial load & Socket Command Listener from Central Dashboard
  useEffect(() => {
    document.title = 'GuardianBand | Wearable Device Simulator';
    api.getUser(userId).then(setRegisteredUser).catch(() => {});
    requestRealLocation(true);

    // Bi-Directional Command Receiver: Central Dashboard -> Node.js -> Device Simulator
    const onDeviceCommand = (payload: { deviceId: string; command: DeviceCommand; params?: any }) => {
      if (payload.deviceId === deviceId) {
        console.log('[DeviceSimulator] ⚡ Received command from Central Dashboard:', payload.command);
        setLastReceivedCommand(payload.command);
        setCommandFeedbackFlash(payload.command);
        setTimeout(() => setCommandFeedbackFlash(null), 4000);

        if (payload.command === 'START_TRACKING') {
          startGpsStreaming();
          setStatusMessage(`📡 Central Dashboard command: START_TRACKING executed. Pinging GPS.`);
        } else if (payload.command === 'STOP_TRACKING') {
          stopGpsStreaming();
          setStatusMessage(`⏹ Central Dashboard command: STOP_TRACKING executed. Tracking idle.`);
        } else if (payload.command === 'REQUEST_LOCATION') {
          handleSendManualLocation();
          setStatusMessage(`📍 Central Dashboard command: REQUEST_LOCATION executed. Pushed coordinates.`);
        } else if (payload.command === 'TEST_SOS') {
          startVerificationWindow();
          setStatusMessage(`🚨 Central Dashboard command: TEST_SOS initiated 15s verification.`);
        } else if (payload.command === 'CANCEL_TEST_EMERGENCY') {
          handleUserSaidSafe();
          setStatusMessage(`🛑 Central Dashboard command: CANCEL_TEST_EMERGENCY executed.`);
        } else if (payload.command === 'RESET_DEVICE') {
          handleResetToNormal();
          setStatusMessage(`🔄 Central Dashboard command: RESET_DEVICE executed. Device in NORMAL state.`);
        }
      }
    };

    socket.on('device:command', onDeviceCommand);

    return () => {
      socket.off('device:command', onDeviceCommand);
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (stage1TimeoutRef.current) clearTimeout(stage1TimeoutRef.current);
      if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (gpsStreamIntervalRef.current) clearInterval(gpsStreamIntervalRef.current);
    };
  }, [userId, deviceId]);

  // =========================================================================
  // SOS 2-PRESS WORKFLOW (1st Click -> 1st Press Detected -> 2nd Click -> 15s "ARE YOU SAFE?")
  // =========================================================================
  const handleSOSPress = () => {
    if (sosState === 'COUNTDOWN_15S' || sosState === 'VERIFIED') return;

    const now = Date.now();
    // Debounce rapid repeat taps (minimum 250ms gap between distinct presses)
    if (now - lastPressTimeRef.current < 250) {
      return;
    }
    lastPressTimeRef.current = now;

    if (sosState === 'IDLE' || sosState === 'CANCELLED') {
      // 1st Press Detected IMMEDIATELY on first press/click!
      if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
      if (stage1TimeoutRef.current) clearTimeout(stage1TimeoutRef.current);

      setSosState('STAGE_1_DONE');
      setConfirmCountdown(5);
      setStatusMessage('👆 1st Press Detected! Click SOS button again within 5s to confirm emergency.');

      // 5-second countdown window for 2nd press
      let remaining = 5;
      confirmIntervalRef.current = window.setInterval(() => {
        remaining -= 1;
        setConfirmCountdown(remaining);
        if (remaining <= 0) {
          if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
          setSosState((curr) => {
            if (curr === 'STAGE_1_DONE') {
              setStatusMessage('Confirmation window expired (>5s). SOS activation cancelled. Reset to NORMAL.');
              return 'IDLE';
            }
            return curr;
          });
        }
      }, 1000);

    } else if (sosState === 'STAGE_1_DONE') {
      // 2nd Press Detected IMMEDIATELY on click!
      if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
      if (stage1TimeoutRef.current) clearTimeout(stage1TimeoutRef.current);

      setStatusMessage('🚨 2nd Press Confirmed! Initiating "ARE YOU SAFE?" 15-second safety verification.');
      startVerificationWindow();
    }
  };

  // 1-Click Fast Shortcut for Testing
  const handleFastTestTrigger = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    if (stage1TimeoutRef.current) clearTimeout(stage1TimeoutRef.current);
    if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
    setStatusMessage('⚡ 1-Click Fast Test triggered: 2-press deliberate SOS simulated.');
    startVerificationWindow();
  };

  // Start 15-Second Verification Window
  const startVerificationWindow = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setSosState('COUNTDOWN_15S');
    setCountdown(15);
    setStatusMessage('🚨 "ARE YOU SAFE?" verification window active! 15s countdown initiated.');

    // Notify backend and Central Dashboard that verification is active
    api.deviceUpdateTelemetry({
      deviceId,
      emergencyState: 'VERIFYING',
      battery,
      heartRate,
      spo2
    }).catch(() => {});

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Timer reached 0 with NO response -> Automatic VERIFIED_EMERGENCY
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          handleVerificationTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleUserSaidSafe = async () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setSosState('CANCELLED');
    setStatusMessage('Wearer confirmed "YES, I\'M SAFE". SOS Cancelled. Device returned to NORMAL.');

    try {
      await api.deviceCancelSOS({
        deviceId,
        userId,
        triggerTime: new Date(Date.now() - 15000).toISOString(),
        cancellationTime: new Date().toISOString(),
        reason: 'USER_RESPONDED_SAFE_15S_WINDOW'
      });
    } catch (err) {
      console.warn('Failed to post cancel to backend:', err);
    }
  };

  const handleUserSaidEmergency = async () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setStatusMessage('Explicit emergency confirmed by wearer ("NO / EMERGENCY"). Verifying immediately.');
    await dispatchVerifiedSOS('EXPLICIT_EMERGENCY_CONFIRMED');
  };

  const handleVerificationTimeout = async () => {
    setStatusMessage('15-second safety timer expired with NO RESPONSE. Automating SOS escalation.');
    await dispatchVerifiedSOS('NO_RESPONSE_15S');
  };

  const dispatchVerifiedSOS = async (verificationMethod: string) => {
    setSosState('VERIFIED');
    setTrackingStatus('ACTIVE');
    const triggerTime = new Date(Date.now() - 25000).toISOString();
    const verificationTime = new Date().toISOString();

    const resolvedAddress = 
      !gpsAvailable ? 'Location Unavailable' :
      locationSource === 'REAL_BROWSER' ? realAddress :
      locationSource === 'SIMULATED_LOCAL' ? routeWaypoints[gpsStep % routeWaypoints.length].addr :
      customAddress || `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;

    try {
      const response = await api.deviceTriggerSOS({
        deviceId,
        userId,
        token,
        triggerTime,
        verificationTime,
        verificationMethod,
        latitude: gpsAvailable ? latitude : null,
        longitude: gpsAvailable ? longitude : null,
        address: resolvedAddress,
        battery,
        cellularSignalDbm: -68,
        heartRate,
        spo2,
        source: 'SIMULATOR'
      });

      setActiveEmergencyId(response.emergencyId);
      if (response.smsDispatch) {
        console.log('[DeviceSimulator] SMS dispatched count:', response.smsDispatch.dispatched);
      }
      setStatusMessage(`🚨 VERIFIED EMERGENCY: Incident ${response.emergencyId}. AI escalation sent to Police Control Room. SMS dispatched.`);
      if (onSOSDispatched) onSOSDispatched();

      // Automatically start live GPS streaming
      startGpsStreaming(response.emergencyId);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Transmission failed: ${msg}`);
    }
  };

  // Continuous GPS Breadcrumb Streaming
  const startGpsStreaming = (targetEmergencyId?: string) => {
    setIsStreamingGps(true);
    setTrackingStatus('ACTIVE');

    if (gpsStreamIntervalRef.current) {
      clearInterval(gpsStreamIntervalRef.current);
      gpsStreamIntervalRef.current = null;
    }

    const effectiveEmergencyId = targetEmergencyId || activeEmergencyId || undefined;
    setStatusMessage('🛰️ Live GPS Streaming active! Sending breadcrumb pings every 3s to Central Command & Police EOC...');

    let pingCount = 1;
    setStreamingPingCount(pingCount);

    const initialAddr = locationSource === 'REAL_BROWSER' ? realAddress :
      locationSource === 'SIMULATED_LOCAL' ? routeWaypoints[gpsStep % routeWaypoints.length].addr :
      customAddress || `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;

    if (gpsAvailable) {
      api.deviceSendLocation({
        deviceId,
        userId,
        emergencyId: effectiveEmergencyId,
        latitude,
        longitude,
        address: initialAddr,
        heartRate,
        spo2,
        token
      }).then(() => {
        setStatusMessage(`📡 Live GPS Streaming: Ping #1 sent (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
      }).catch((e) => console.warn('Stream ping error:', e));
    }

    let localLat = latitude;
    let localLng = longitude;
    let currentStep = gpsStep;

    gpsStreamIntervalRef.current = window.setInterval(async () => {
      pingCount += 1;
      setStreamingPingCount(pingCount);

      if (locationSource === 'SIMULATED_LOCAL') {
        currentStep = (currentStep + 1) % routeWaypoints.length;
        setGpsStep(currentStep);
        const nextCoord = routeWaypoints[currentStep];
        localLat = nextCoord.lat;
        localLng = nextCoord.lng;
        setLatitude(localLat);
        setLongitude(localLng);

        if (gpsAvailable) {
          api.deviceSendLocation({
            deviceId,
            userId,
            emergencyId: effectiveEmergencyId,
            latitude: localLat,
            longitude: localLng,
            address: nextCoord.addr,
            heartRate,
            spo2,
            token
          }).then(() => {
            setStatusMessage(`📡 Streaming Ping #${pingCount}: ${nextCoord.addr} (${localLat.toFixed(4)}, ${localLng.toFixed(4)})`);
          }).catch((e) => console.warn('Stream ping error:', e));
        }

      } else {
        // REAL_BROWSER or CUSTOM: advance with gentle walking steps (~15m per 3s)
        const deltaLat = (pingCount % 2 === 0 ? 0.00012 : -0.00008) * Math.sin(pingCount);
        const deltaLng = 0.00015;
        localLat = Number((localLat + deltaLat).toFixed(5));
        localLng = Number((localLng + deltaLng).toFixed(5));

        setLatitude(localLat);
        setLongitude(localLng);

        const currentAddr = locationSource === 'REAL_BROWSER' ? realAddress : customAddress || 'Live GPS Walking Track';

        if (gpsAvailable) {
          api.deviceSendLocation({
            deviceId,
            userId,
            emergencyId: effectiveEmergencyId,
            latitude: localLat,
            longitude: localLng,
            address: currentAddr,
            heartRate,
            spo2,
            token
          }).then(() => {
            setStatusMessage(`📡 Streaming Ping #${pingCount}: (${localLat.toFixed(4)}, ${localLng.toFixed(4)}) transmitted to Central & Police Maps`);
          }).catch((e) => console.warn('Stream ping error:', e));
        }
      }
    }, 3000);
  };

  const stopGpsStreaming = () => {
    setIsStreamingGps(false);
    setTrackingStatus('IDLE');
    if (gpsStreamIntervalRef.current) {
      clearInterval(gpsStreamIntervalRef.current);
      gpsStreamIntervalRef.current = null;
    }
    setStatusMessage(`⏹ GPS streaming stopped (${streamingPingCount} total pings sent). Tracking IDLE.`);

    api.deviceUpdateTelemetry({
      deviceId,
      trackingStatus: 'IDLE'
    }).catch(() => {});
  };

  const handleSendManualLocation = async () => {
    try {
      const addr = locationSource === 'REAL_BROWSER' ? realAddress :
        locationSource === 'SIMULATED_LOCAL' ? routeWaypoints[gpsStep % routeWaypoints.length].addr :
        customAddress || `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;

      await api.deviceSendLocation({
        deviceId,
        userId,
        emergencyId: activeEmergencyId || undefined,
        latitude,
        longitude,
        address: addr,
        heartRate,
        spo2,
        token
      });
      setStatusMessage(`📍 Location ping sent: (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`❌ Location ping failed: ${msg}`);
    }
  };

  const handleResetToNormal = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    if (stage1TimeoutRef.current) clearTimeout(stage1TimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (gpsStreamIntervalRef.current) clearInterval(gpsStreamIntervalRef.current);
    if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);

    setSosState('IDLE');
    setTrackingStatus('IDLE');
    setIsStreamingGps(false);
    setConfirmCountdown(5);
    setActiveEmergencyId(null);
    setHeartRate(78);
    setSpo2(98);
    setStatusMessage('Device reset to NORMAL standby state.');

    api.resetDevice(deviceId).catch(() => {});
  };

  const handleLaunchPopout = () => {
    window.open(
      '/?view=SIMULATOR', 
      'GuardianBand_DeviceSimulator_Window', 
      'width=540,height=960,resizable=yes,scrollbars=yes,status=no,location=no'
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Top Architecture Header & Remote Flash */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
              DEVICE SIMULATOR CONSOLE
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
              SOURCE: {source} (ESP32 + MAX30102 + SIM800L MODEL)
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">
            GuardianBand Virtual Hardware Simulator
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Wearer: <b className="text-white">{registeredUser?.name || 'Priya Sharma'}</b> ({deviceId} / {userId})
          </p>
        </div>

        {/* Real-time Link Status & Standalone Popout Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleLaunchPopout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/60 hover:bg-purple-800/80 border border-purple-600/50 text-purple-200 text-xs font-mono font-bold transition cursor-pointer shadow"
            title="Open Device Simulator in a separate standalone window side-by-side with Central Dashboard"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>SEPARATE WINDOW (POPOUT)</span>
          </button>

          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-emerald-400">Node.js Bus Live</span>
            </div>
          </div>

          <NetworkLauncher currentSite="SIMULATOR" />
        </div>
      </div>

      {/* FLASH COMMAND FEEDBACK BANNER */}
      {commandFeedbackFlash && (
        <div className="bg-gradient-to-r from-purple-900/80 via-indigo-900/80 to-purple-950/90 border border-purple-500 text-white px-4 py-2.5 rounded-xl flex items-center justify-between shadow-2xl animate-pulse font-mono text-xs">
          <div className="flex items-center gap-2 font-bold">
            <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
            <span>CENTRAL DASHBOARD COMMAND EXECUTED: [{commandFeedbackFlash}]</span>
          </div>
          <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded text-purple-200">
            ACKNOWLEDGED
          </span>
        </div>
      )}

      {/* Main Grid: Virtual Hardware Wearable (Left 5 Cols) + Hardware Bench (Right 7 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* =================================================================== */}
        {/* WEARABLE PHYSICAL HARDWARE CONSOLE (5 COLS)                         */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Virtual Wearable Hardware Bezel</span>
          </div>

          {/* Realistic Watch Strap & Chassis */}
          <div className="relative flex flex-col items-center">
            {/* Top Strap */}
            <div className="w-24 h-14 bg-gradient-to-b from-slate-900 to-slate-800 rounded-t-2xl border-t border-x border-slate-700 shadow-inner"></div>

            {/* Smartwatch Outer Bezel */}
            <div className="relative w-72 h-72 rounded-full bg-gradient-to-br from-slate-800 via-slate-900 to-black p-4 border-4 border-slate-700 shadow-2xl flex items-center justify-center">

              {/* Outer LED status ring */}
              <div className={`absolute inset-2 rounded-full border-2 transition-all duration-300 ${
                sosState === 'COUNTDOWN_15S' ? 'border-amber-500/80 animate-pulse' :
                sosState === 'VERIFIED' ? 'border-rose-500 animate-pulse' :
                sosState === 'STAGE_1_DONE' ? 'border-amber-400 animate-pulse' :
                'border-slate-800'
              }`} />

              {/* OLED Circular Screen */}
              <div className="relative w-60 h-60 rounded-full bg-black border border-slate-800 flex flex-col items-center justify-center p-4 text-center overflow-hidden shadow-inner select-none">
                
                {/* Screen Top Status Bar */}
                <div className="absolute top-4 flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Heart className="w-2.5 h-2.5 text-rose-500" />
                    {heartRate}
                  </span>
                  <span>•</span>
                  <span>{battery}%</span>
                </div>

                {/* OLED SCREEN STATES */}
                {sosState === 'IDLE' && (
                  <div className="space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
                      GUARDIANBAND
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Press SOS button 2 times to trigger emergency
                    </p>
                  </div>
                )}

                {sosState === 'STAGE_1_DONE' && (
                  <div className="space-y-1 animate-pulse">
                    <div className="w-8 h-8 mx-auto rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] font-mono font-bold text-amber-300 uppercase">
                      1ST PRESS DETECTED!
                    </p>
                    <p className="text-[10px] text-white font-bold leading-tight">
                      Click SOS button again to confirm
                    </p>
                    <p className="text-[9px] text-amber-400 font-mono">
                      Confirm window: {confirmCountdown}s remaining
                    </p>
                  </div>
                )}

                {sosState === 'COUNTDOWN_15S' && (
                  <div className="space-y-1">
                    <p className="text-xs font-black tracking-widest text-rose-400 uppercase animate-pulse">
                      ARE YOU SAFE?
                    </p>
                    <div className="text-5xl font-mono font-black text-white drop-shadow-md">
                      {countdown}
                    </div>
                    <p className="text-[9px] text-slate-400 uppercase">
                      Seconds until police auto-escalation
                    </p>

                    <div className="pt-2 flex items-center gap-2 justify-center">
                      <button
                        onClick={handleUserSaidSafe}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-600 hover:bg-emerald-500 text-white transition-transform active:scale-95 cursor-pointer shadow"
                      >
                        YES, I'M SAFE
                      </button>
                      <button
                        onClick={handleUserSaidEmergency}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-transform active:scale-95 cursor-pointer shadow animate-pulse"
                      >
                        NO / SOS
                      </button>
                    </div>
                  </div>
                )}

                {sosState === 'VERIFIED' && (
                  <div className="space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-rose-500 text-white flex items-center justify-center animate-pulse">
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-black tracking-wider text-rose-500 uppercase">
                      🚨 SOS VERIFIED
                    </p>
                    <p className="text-[10px] text-slate-300 font-mono">
                      Cellular alert escalated to Police Control Room
                    </p>
                  </div>
                )}

                {sosState === 'CANCELLED' && (
                  <div className="space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-emerald-400 uppercase">
                      SOS CANCELLED
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Safety verified. System returned to standby.
                    </p>
                  </div>
                )}

                {/* Bottom Screen Device ID */}
                <div className="absolute bottom-3 text-[9px] font-mono text-slate-500">
                  {deviceId} • {trackingStatus === 'ACTIVE' ? '🛰️ TRACKING' : 'IDLE'}
                </div>
              </div>

              {/* Physical SOS Button on Bezel Right (Immediate 1-Click First Press Detection) */}
              <button
                onClick={handleSOSPress}
                title="Physical SOS Button: Click once for 1st press, then click again to confirm emergency"
                className={`absolute -right-3.5 top-1/2 -translate-y-1/2 w-8 h-16 rounded-r-lg bg-gradient-to-r transition-all border-t border-b border-r shadow-lg flex items-center justify-center cursor-pointer select-none group ${
                  sosState === 'STAGE_1_DONE'
                    ? 'from-amber-600 to-rose-600 animate-pulse border-amber-300 ring-4 ring-amber-500/50 scale-105'
                    : 'from-rose-700 to-rose-600 hover:from-rose-600 border-rose-400 active:scale-95'
                }`}
              >
                <div className="rotate-90 text-[10px] font-black tracking-widest text-white uppercase group-hover:scale-110 transition-transform">
                  SOS
                </div>
              </button>
            </div>

            {/* Bottom Strap */}
            <div className="w-24 h-14 bg-gradient-to-t from-slate-900 to-slate-800 rounded-b-2xl border-b border-x border-slate-700 shadow-inner"></div>
          </div>

          {/* Quick Trigger Helpers & Reset */}
          <div className="mt-4 flex items-center gap-2 flex-wrap justify-center max-w-sm">
            <button
              onClick={handleFastTestTrigger}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-700 to-red-700 hover:from-rose-600 hover:to-red-600 text-white text-xs font-mono font-bold cursor-pointer shadow transition"
              title="Immediately initiate 'ARE YOU SAFE?' 15s countdown"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>⚡ 1-CLICK INSTANT SOS (FAST TEST)</span>
            </button>

            <button
              onClick={handleResetToNormal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition cursor-pointer border border-slate-700"
              title="Reset device simulator to NORMAL state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET DEVICE</span>
            </button>
          </div>

          {/* Hardware Instruction Badge */}
          <div className="mt-3 bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-400 max-w-xs text-center space-y-0.5">
            <p className="font-semibold text-slate-200">Hardware SOS Protocol:</p>
            <p>1. Press SOS button once (1st press detected immediately).</p>
            <p>2. Press SOS button 2nd time within 5s to confirm.</p>
            <p>3. "ARE YOU SAFE?" 15-second safety timer verifies emergency.</p>
          </div>
        </div>

        {/* =================================================================== */}
        {/* HARDWARE BENCH & SENSOR CONTROLS (7 COLS)                          */}
        {/* =================================================================== */}
        <div className="lg:col-span-7 space-y-6">

          {/* SYSTEM TERMINAL STATUS DISPLAY */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs shadow-md">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2 mb-2">
              <span className="flex items-center gap-1.5 font-bold text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                <span>SIMULATOR STATUS BUS</span>
              </span>
              <span className="text-[10px] text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                STATE: {sosState}
              </span>
            </div>
            <p className="text-slate-200 font-mono leading-relaxed">
              {statusMessage}
            </p>
            {lastReceivedCommand && (
              <div className="mt-2 pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                <span>Last Command from Central: <b className="text-cyan-400">[{lastReceivedCommand}]</b></span>
                <span>Active Tracking: <b className={trackingStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-slate-400'}>{trackingStatus}</b></span>
              </div>
            )}
          </div>

          {/* 1. MAX30102 SENSOR HEALTH TELEMETRY */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
                <Heart className="w-4 h-4 text-rose-500 animate-pulse" />
                <span>MAX30102 Biosensor Telemetry (Heart Rate & SpO2)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">I2C BUS 0x57</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Heart Rate Slider */}
              <div className="space-y-2 bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-400" /> Heart Rate:
                  </span>
                  <span className="text-base font-bold text-white font-mono">{heartRate} BPM</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="180"
                  value={heartRate}
                  onChange={(e) => handleUpdateHealthTelemetry(Number(e.target.value), spo2)}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <button
                    onClick={() => handleUpdateHealthTelemetry(75, spo2)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Normal (75)
                  </button>
                  <button
                    onClick={() => handleUpdateHealthTelemetry(135, spo2)}
                    className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40"
                  >
                    Distress (135)
                  </button>
                </div>
              </div>

              {/* SpO2 Slider */}
              <div className="space-y-2 bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" /> Blood Oxygen (SpO2):
                  </span>
                  <span className="text-base font-bold text-cyan-300 font-mono">{spo2}%</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="100"
                  value={spo2}
                  onChange={(e) => handleUpdateHealthTelemetry(heartRate, Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <button
                    onClick={() => handleUpdateHealthTelemetry(heartRate, 98)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Normal (98%)
                  </button>
                  <button
                    onClick={() => handleUpdateHealthTelemetry(heartRate, 89)}
                    className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/40"
                  >
                    Hypoxia (89%)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. WEARER GPS SOURCE SELECTION */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>Wearer GPS Source Selection</span>
              </span>

              <div className="flex items-center gap-1 text-[11px] font-mono">
                <button
                  onClick={() => {
                    setLocationSource('REAL_BROWSER');
                    requestRealLocation();
                  }}
                  className={`px-2.5 py-1 rounded cursor-pointer transition ${
                    locationSource === 'REAL_BROWSER' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  My Real GPS
                </button>
                <button
                  onClick={() => {
                    setLocationSource('SIMULATED_LOCAL');
                    setLatitude(routeWaypoints[0].lat);
                    setLongitude(routeWaypoints[0].lng);
                  }}
                  className={`px-2.5 py-1 rounded cursor-pointer transition ${
                    locationSource === 'SIMULATED_LOCAL' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Campus Route
                </button>
              </div>
            </div>

            {/* Resolved GPS Details */}
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Current Address:</span>
                <button
                  onClick={() => requestRealLocation()}
                  disabled={isLocating}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>Refresh GPS</span>
                </button>
              </div>

              <p className="text-white font-medium">
                {locationSource === 'REAL_BROWSER' ? realAddress : routeWaypoints[gpsStep % routeWaypoints.length].addr}
              </p>

              <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                <span>Lat: <b className="text-cyan-400">{latitude.toFixed(5)}°</b></span>
                <span>Lng: <b className="text-cyan-400">{longitude.toFixed(5)}°</b></span>
                {realAccuracy && <span>Accuracy: <b className="text-slate-300">±{realAccuracy}m</b></span>}
              </div>

              {/* Quick Pin Buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 flex-wrap text-[11px]">
                <span className="text-slate-400">Quick Pin:</span>
                <button
                  onClick={() => handleSelectPlace({ name: "Kalaignar Karunanidhi Institute of Technology, Kannampalayam", latitude: 10.9993, longitude: 77.0842 })}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 cursor-pointer"
                >
                  KIT Campus
                </button>
                <button
                  onClick={() => handleSelectPlace({ name: "Kannampalayam Junction, Coimbatore", latitude: 10.9975, longitude: 77.0865 })}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 cursor-pointer"
                >
                  Kannampalayam
                </button>
                <button
                  onClick={() => handleSelectPlace({ name: "Sulur Air Force Station Rd, Coimbatore", latitude: 10.9940, longitude: 77.0940 })}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 cursor-pointer"
                >
                  Sulur
                </button>
              </div>
            </div>

            {/* GPS Streaming & Manual Ping Actions */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                onClick={handleSendManualLocation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold cursor-pointer transition border border-slate-700"
              >
                <Send className="w-3.5 h-3.5 text-cyan-400" />
                <span>Send GPS Ping</span>
              </button>

              {isStreamingGps ? (
                <button
                  onClick={stopGpsStreaming}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold cursor-pointer transition shadow animate-pulse"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop GPS Stream ({streamingPingCount} pings)</span>
                </button>
              ) : (
                <button
                  onClick={() => startGpsStreaming()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold cursor-pointer transition shadow"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start GPS Stream (3s Interval)</span>
                </button>
              )}
            </div>
          </div>

          {/* 3. BATTERY & HARDWARE TOGGLES */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
                <Battery className="w-4 h-4 text-amber-400" />
                <span>Hardware Battery & Signal Conditions</span>
              </span>
              <span className="text-xs font-mono text-slate-300 font-bold">{battery}%</span>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min="5"
                max="100"
                value={battery}
                onChange={(e) => {
                  const b = Number(e.target.value);
                  setBattery(b);
                  api.deviceUpdateTelemetry({ deviceId, battery: b }).catch(() => {});
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />

              <div className="grid grid-cols-2 gap-3 pt-1 text-xs font-mono">
                <button
                  onClick={() => {
                    const next = !cellularConnected;
                    setCellularConnected(next);
                    api.deviceUpdateTelemetry({
                      deviceId,
                      cellularStatus: next ? 'CONNECTED' : 'DISCONNECTED'
                    }).catch(() => {});
                  }}
                  className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                    cellularConnected 
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' 
                      : 'bg-rose-950/40 border-rose-800 text-rose-400'
                  }`}
                >
                  Cellular: {cellularConnected ? '4G LTE ONLINE' : 'DISCONNECTED'}
                </button>

                <button
                  onClick={() => {
                    const next = !gpsAvailable;
                    setGpsAvailable(next);
                    api.deviceUpdateTelemetry({
                      deviceId,
                      gpsStatus: next ? 'AVAILABLE' : 'UNAVAILABLE'
                    }).catch(() => {});
                  }}
                  className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                    gpsAvailable 
                      ? 'bg-cyan-950/40 border-cyan-800 text-cyan-400' 
                      : 'bg-amber-950/40 border-amber-800 text-amber-400'
                  }`}
                >
                  GPS: {gpsAvailable ? 'LOCKED' : 'UNAVAILABLE'}
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default DeviceSimulator;
