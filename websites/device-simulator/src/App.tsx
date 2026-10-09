import React, { useState, useEffect, useRef } from 'react';
import { api, socket } from './services/api';
import type { User, DeviceCommand } from './types';
import { 
  Battery, ShieldAlert, CheckCircle2, 
  MapPin, Play, Square, Send, RefreshCw, 
  Shield, Check, Heart, Activity, 
  ExternalLink, Zap, RotateCcw, Terminal,
  Database, Radio, MessageSquare, Cpu, Wifi
} from 'lucide-react';
import { reverseGeocode } from './utils/geoUtils';
import { NetworkLauncher } from './components/NetworkLauncher';

interface AppProps {
  onSOSDispatched?: () => void;
}

export const App: React.FC<AppProps> = ({ onSOSDispatched }) => {
  // =========================================================================
  // 1. ESP32 LOCAL STORAGE (Flash / NVS Storage Model)
  // =========================================================================
  const [deviceId] = useState('GB-1024');
  const [userId] = useState('USER-1024');
  const [token] = useState('tok_gb1024_secure');
  const [source] = useState<'SIMULATOR' | 'PHYSICAL_DEVICE'>('SIMULATOR');

  // Stored User Info in Local NVS Flash
  const [storedUser] = useState({
    name: 'Priya Sharma',
    age: 24,
    gender: 'Female',
    bloodGroup: 'B+',
    medicalNotes: 'Mild Asthma, Penicillin Allergy'
  });

  // Stored Emergency Contact in Local NVS Flash
  const [storedEmergencyContact] = useState({
    name: 'Sunita Sharma',
    relation: 'Mother',
    phone: '+91 98765 43210'
  });

  // User Dashboard / Tracking URL stored in Local NVS Flash
  const [storedTrackingUrl] = useState(`http://localhost:5175/portal?id=GB-1024`);

  // =========================================================================
  // 2. SENSORS (GPS + MAX30102 Heart Rate & SpO2)
  // =========================================================================
  const [battery, setBattery] = useState(84);
  const [gpsAvailable, setGpsAvailable] = useState(true);
  const [cellularConnected, setCellularConnected] = useState(true);
  const [heartRate, setHeartRate] = useState(78); // MAX30102 simulated HR (BPM)
  const [spo2, setSpo2] = useState(98);           // MAX30102 simulated SpO2 (%)
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

  // =========================================================================
  // 3. EXACT GUARDIANBAND STATE MACHINE
  // NORMAL -> 1st SOS PRESS -> 2nd SOS PRESS -> 15s TIMER
  //    Branch A: 3rd Press within 15s -> EMERGENCY CANCELLED -> NORMAL
  //    Branch B: No 3rd Press for 15s -> VERIFIED EMERGENCY -> SIM800L Dual Dispatch
  // =========================================================================
  type SosWorkflowState = 
    | 'NORMAL' 
    | '1ST_PRESS_DETECTED' 
    | 'COUNTDOWN_15S' 
    | 'EMERGENCY_CANCELLED' 
    | 'VERIFIED_EMERGENCY';

  const [sosState, setSosState] = useState<SosWorkflowState>('NORMAL');
  const [countdown, setCountdown] = useState(15);
  const [confirmCountdown, setConfirmCountdown] = useState<number>(5);
  const [activeEmergencyId, setActiveEmergencyId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Wearer Normal. Standby monitoring.');
  const [lastReceivedCommand, setLastReceivedCommand] = useState<string | null>(null);
  const [commandFeedbackFlash, setCommandFeedbackFlash] = useState<string | null>(null);

  // SIM800L Module Real-time Indicators
  const [sim800lSmsStatus, setSim800lSmsStatus] = useState<'IDLE' | 'DISPATCHING' | 'SENT_TO_CONTACTS'>('IDLE');
  const [sim800lGprsStatus, setSim800lGprsStatus] = useState<'IDLE' | 'TRANSMITTING' | 'DELIVERED_TO_BACKEND'>('IDLE');

  // Timers and Interval Refs
  const confirmIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const lastPressTimeRef = useRef<number>(0);
  const gpsStreamIntervalRef = useRef<number | null>(null);

  // Campus route waypoints (KIT Campus -> Kannampalayam -> Sulur)
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
        emergencyState: sosState === 'VERIFIED_EMERGENCY' ? 'VERIFIED_EMERGENCY' : sosState === 'COUNTDOWN_15S' ? 'VERIFYING' : 'NORMAL'
      });
      setStatusMessage(`💓 Sensor Telemetry synced: HR ${newHR} BPM, SpO2 ${newSpO2}%`);
    } catch (err) {
      console.warn('Telemetry sync error:', err);
    }
  };

  // =========================================================================
  // Initial load & Socket Command Listener from Central Dashboard & Police
  // =========================================================================
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
          start15SecondTimer();
          setStatusMessage(`🚨 Central Dashboard command: TEST_SOS initiated 15s verification window.`);
        } else if (payload.command === 'CANCEL_TEST_EMERGENCY') {
          handleThirdPressCancel();
          setStatusMessage(`🛑 Central Dashboard command: CANCEL_TEST_EMERGENCY executed.`);
        } else if (payload.command === 'RESET_DEVICE') {
          handleResetToNormal();
          setStatusMessage(`🔄 Incident Resolved. Device returned to NORMAL standby state.`);
        }
      }
    };

    // Listen for Emergency Status Resolution from Central or Police Control Room
    const onEmergencyUpdated = (emg: any) => {
      if (emg && emg.status === 'RESOLVED') {
        console.log('[DeviceSimulator] ✅ Emergency Resolved by Operations! Returning device to NORMAL.');
        handleResetToNormal();
        setStatusMessage('✅ Emergency Resolved by Operations Control Room! Device returned to NORMAL.');
      }
    };

    socket.on('device:command', onDeviceCommand);
    socket.on('emergency:updated', onEmergencyUpdated);

    return () => {
      socket.off('device:command', onDeviceCommand);
      socket.off('emergency:updated', onEmergencyUpdated);
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (gpsStreamIntervalRef.current) clearInterval(gpsStreamIntervalRef.current);
    };
  }, [userId, deviceId]);

  // =========================================================================
  // SOS FINITE STATE MACHINE CONTROLLER (Matches User's Final Workflow)
  // =========================================================================

  /**
   * Main SOS Button Click Handler:
   * 1st Click -> 1st SOS PRESS
   * 2nd Click within 5s -> 2nd SOS PRESS -> START 15-SECOND TIMER
   * 3rd Click within 15s -> EMERGENCY CANCELLED -> NORMAL
   */
  const handleSOSPress = () => {
    const now = Date.now();
    // Debounce rapid repeat taps (minimum 250ms gap)
    if (now - lastPressTimeRef.current < 250) {
      return;
    }
    lastPressTimeRef.current = now;

    // Case 1: NORMAL STATE -> 1st SOS PRESS
    if (sosState === 'NORMAL' || sosState === 'EMERGENCY_CANCELLED') {
      if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      setSosState('1ST_PRESS_DETECTED');
      setConfirmCountdown(5);
      setStatusMessage('👆 1st SOS PRESS DETECTED! Press SOS button 2nd time within 5s to confirm.');

      let remaining = 5;
      confirmIntervalRef.current = window.setInterval(() => {
        remaining -= 1;
        setConfirmCountdown(remaining);
        if (remaining <= 0) {
          if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
          setSosState((curr) => {
            if (curr === '1ST_PRESS_DETECTED') {
              setStatusMessage('Confirmation window expired (>5s). Reset to NORMAL state.');
              return 'NORMAL';
            }
            return curr;
          });
        }
      }, 1000);
    } 
    // Case 2: 1ST PRESS DETECTED -> 2nd SOS PRESS
    else if (sosState === '1ST_PRESS_DETECTED') {
      if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
      setStatusMessage('🚨 2nd SOS PRESS CONFIRMED! Starting 15-second safety timer.');
      start15SecondTimer();
    }
    // Case 3: 15-SECOND TIMER ACTIVE -> 3rd Press within 15 seconds -> CANCEL!
    else if (sosState === 'COUNTDOWN_15S') {
      handleThirdPressCancel();
    }
  };

  /**
   * Starts the 15-Second Timer
   */
  const start15SecondTimer = () => {
    if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setSosState('COUNTDOWN_15S');
    setCountdown(15);
    setStatusMessage('🚨 15-Second Safety Timer active! Press SOS 3rd time within 15s to cancel, or wait for verification.');

    // Notify backend that verification window is active
    api.deviceUpdateTelemetry({
      deviceId,
      emergencyState: 'VERIFYING',
      battery,
      heartRate,
      spo2
    }).catch(() => {});

    let remaining = 15;
    countdownIntervalRef.current = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        // Branch B: No 3rd Press for 15 seconds -> VERIFIED EMERGENCY!
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        handleVerificationTimeout();
      }
    }, 1000);
  };

  /**
   * Branch A: 3rd Press within 15 seconds -> EMERGENCY CANCELLED -> NORMAL
   */
  const handleThirdPressCancel = async () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);

    setSosState('EMERGENCY_CANCELLED');
    setStatusMessage('🛑 3rd Press detected within 15 seconds: EMERGENCY CANCELLED! Device returning to NORMAL.');

    try {
      await api.deviceCancelSOS({
        deviceId,
        userId,
        triggerTime: new Date(Date.now() - 15000).toISOString(),
        cancellationTime: new Date().toISOString(),
        reason: '3RD_PRESS_WITHIN_15S_EMERGENCY_CANCELLED'
      });
    } catch (err) {
      console.warn('Failed to post cancel to backend:', err);
    }

    // Automatically return to NORMAL after 2.5 seconds
    setTimeout(() => {
      setSosState((curr) => {
        if (curr === 'EMERGENCY_CANCELLED') {
          setStatusMessage('Device in NORMAL standby monitoring state.');
          return 'NORMAL';
        }
        return curr;
      });
    }, 2500);
  };

  /**
   * Branch B: No 3rd Press for 15 seconds -> VERIFIED EMERGENCY
   */
  const handleVerificationTimeout = async () => {
    setStatusMessage('🚨 No 3rd Press for 15 seconds: VERIFIED EMERGENCY! Collecting Emergency Data & SIM800L Dual Dispatch.');
    await dispatchVerifiedSOS('NO_3RD_PRESS_15S');
  };

  /**
   * Collect Emergency Data & SIM800L Dual Dispatch
   */
  const dispatchVerifiedSOS = async (verificationMethod: string) => {
    setSosState('VERIFIED_EMERGENCY');
    setTrackingStatus('ACTIVE');
    setSim800lSmsStatus('DISPATCHING');
    setSim800lGprsStatus('TRANSMITTING');

    const triggerTime = new Date(Date.now() - 20000).toISOString();
    const verificationTime = new Date().toISOString();

    const resolvedAddress = 
      !gpsAvailable ? 'Location Unavailable' :
      locationSource === 'REAL_BROWSER' ? realAddress :
      locationSource === 'SIMULATED_LOCAL' ? routeWaypoints[gpsStep % routeWaypoints.length].addr :
      customAddress || `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;

    try {
      // SIM800L GPRS -> Node.js Backend & Firebase
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
      setSim800lGprsStatus('DELIVERED_TO_BACKEND');
      setSim800lSmsStatus('SENT_TO_CONTACTS');

      setStatusMessage(`🚨 VERIFIED EMERGENCY: Incident ${response.emergencyId}. SIM800L SMS dispatched to Emergency Contacts. SIM800L GPRS received by Node.js Backend & Firebase. AI Forwarding to Police Control Room active.`);
      
      if (onSOSDispatched) onSOSDispatched();

      // Automatically initiate Continuous Location Monitoring (every 3s)
      startGpsStreaming(response.emergencyId);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Transmission failed: ${msg}`);
      setSim800lGprsStatus('IDLE');
    }
  };

  // 1-Click Fast Shortcut for Verification Testing
  const handleFastTestTrigger = () => {
    if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setStatusMessage('⚡ 1-Click Fast Test triggered: Simulating 2-press and 15s verification window.');
    start15SecondTimer();
  };

  // Continuous GPS Breadcrumb Streaming (every 3 seconds)
  const startGpsStreaming = (targetEmergencyId?: string) => {
    setIsStreamingGps(true);
    setTrackingStatus('ACTIVE');

    if (gpsStreamIntervalRef.current) {
      clearInterval(gpsStreamIntervalRef.current);
      gpsStreamIntervalRef.current = null;
    }

    const effectiveEmergencyId = targetEmergencyId || activeEmergencyId || undefined;
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
            setStatusMessage(`📡 Continuous Location Monitoring: Ping #${pingCount} sent (${localLat.toFixed(4)}, ${localLng.toFixed(4)})`);
          }).catch((e) => console.warn('Stream ping error:', e));
        }

      } else {
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
            setStatusMessage(`📡 Continuous Location Monitoring: Ping #${pingCount} -> Central Dashboard & Police Maps`);
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
    setStatusMessage(`⏹ Continuous Location Monitoring stopped. Tracking IDLE.`);

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

  // Return to NORMAL State
  const handleResetToNormal = () => {
    if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (gpsStreamIntervalRef.current) clearInterval(gpsStreamIntervalRef.current);

    setSosState('NORMAL');
    setTrackingStatus('IDLE');
    setIsStreamingGps(false);
    setConfirmCountdown(5);
    setActiveEmergencyId(null);
    setSim800lSmsStatus('IDLE');
    setSim800lGprsStatus('IDLE');
    setHeartRate(78);
    setSpo2(98);
    setStatusMessage('Device in NORMAL standby monitoring state.');

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
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Top Architecture Header & Remote Flash */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
              DEVICE SIMULATOR
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
              SOURCE: {source} (ESP32 + MAX30102 + SIM800L MODEL)
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">
            GuardianBand Virtual Hardware Simulator
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Wearer: <b className="text-white">{registeredUser?.name || storedUser.name}</b> ({deviceId} / {userId}) • Local Flash Synced
          </p>
        </div>

        {/* Real-time Link Status & Standalone Popout Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleLaunchPopout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/60 hover:bg-purple-800/80 border border-purple-600/50 text-purple-200 text-xs font-mono font-bold transition cursor-pointer shadow"
            title="Open Device Simulator in a separate standalone window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>SEPARATE WINDOW</span>
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

      {/* ===================================================================== */}
      {/* WORKFLOW PIPELINE PROGRESS TRACKER (Interactive Real-time Visualizer) */}
      {/* ===================================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Active Workflow State Tracker</span>
          </span>
          <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded font-bold uppercase ${
            sosState === 'VERIFIED_EMERGENCY' ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse' :
            sosState === 'COUNTDOWN_15S' ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse' :
            sosState === '1ST_PRESS_DETECTED' ? 'bg-amber-900/60 text-amber-400 border border-amber-700/60' :
            sosState === 'EMERGENCY_CANCELLED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
            'bg-slate-800 text-slate-300'
          }`}>
            Current: {sosState}
          </span>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs font-mono">
          
          {/* Step 1: Normal State */}
          <div className={`p-2 rounded-lg border transition ${
            sosState === 'NORMAL' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30' : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
          }`}>
            <span className="block text-[10px] text-slate-500 font-bold">STEP 1</span>
            <p className="font-bold mt-0.5">NORMAL</p>
            <span className="text-[10px] text-slate-500">Standby</span>
          </div>

          {/* Step 2: 1st Press */}
          <div className={`p-2 rounded-lg border transition ${
            sosState === '1ST_PRESS_DETECTED' ? 'bg-amber-950/50 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 animate-pulse' : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
          }`}>
            <span className="block text-[10px] text-slate-500 font-bold">STEP 2</span>
            <p className="font-bold mt-0.5">1st PRESS</p>
            <span className="text-[10px] text-slate-500">{sosState === '1ST_PRESS_DETECTED' ? `${confirmCountdown}s window` : 'Awaiting 1st'}</span>
          </div>

          {/* Step 3: 2nd Press */}
          <div className={`p-2 rounded-lg border transition ${
            sosState === '1ST_PRESS_DETECTED' ? 'bg-slate-900/80 border-slate-700 text-amber-400' : 
            sosState === 'COUNTDOWN_15S' || sosState === 'VERIFIED_EMERGENCY' ? 'bg-indigo-950/40 border-indigo-500 text-indigo-300' :
            'bg-slate-950/50 border-slate-800/80 text-slate-400'
          }`}>
            <span className="block text-[10px] text-slate-500 font-bold">STEP 3</span>
            <p className="font-bold mt-0.5">2nd PRESS</p>
            <span className="text-[10px] text-slate-500">Confirmed</span>
          </div>

          {/* Step 4: 15-Second Timer */}
          <div className={`p-2 rounded-lg border transition ${
            sosState === 'COUNTDOWN_15S' ? 'bg-amber-950/70 border-amber-400 text-amber-100 ring-2 ring-amber-400/40 animate-pulse' : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
          }`}>
            <span className="block text-[10px] text-slate-500 font-bold">STEP 4</span>
            <p className="font-bold mt-0.5">15s TIMER</p>
            <span className="text-[10px] font-bold text-amber-400">{sosState === 'COUNTDOWN_15S' ? `${countdown}s left` : '15-sec count'}</span>
          </div>

          {/* Step 5: Decision Branch */}
          <div className={`p-2 rounded-lg border transition ${
            sosState === 'EMERGENCY_CANCELLED' ? 'bg-emerald-950/50 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40' :
            sosState === 'VERIFIED_EMERGENCY' ? 'bg-rose-950/70 border-rose-500 text-rose-100 ring-2 ring-rose-500/40 animate-pulse' :
            'bg-slate-950/50 border-slate-800/80 text-slate-400'
          }`}>
            <span className="block text-[10px] text-slate-500 font-bold">BRANCH</span>
            <p className="font-bold mt-0.5">
              {sosState === 'EMERGENCY_CANCELLED' ? 'CANCELLED' : sosState === 'VERIFIED_EMERGENCY' ? 'VERIFIED' : '3rd/Timeout'}
            </p>
            <span className="text-[10px] text-slate-500">3rd Press / No Press</span>
          </div>

          {/* Step 6: SIM800L Dual Dispatch */}
          <div className={`p-2 rounded-lg border transition ${
            sosState === 'VERIFIED_EMERGENCY' ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200' : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
          }`}>
            <span className="block text-[10px] text-slate-500 font-bold">STEP 6</span>
            <p className="font-bold mt-0.5">SIM800L</p>
            <span className="text-[10px] text-slate-500">SMS + GPRS</span>
          </div>

          {/* Step 7: Central & Police */}
          <div className={`p-2 rounded-lg border transition ${
            sosState === 'VERIFIED_EMERGENCY' ? 'bg-purple-950/60 border-purple-400 text-purple-200' : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
          }`}>
            <span className="block text-[10px] text-slate-500 font-bold">STEP 7</span>
            <p className="font-bold mt-0.5">POLICE + GPS</p>
            <span className="text-[10px] text-slate-500">Continuous 3s</span>
          </div>

        </div>
      </div>

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
                sosState === 'VERIFIED_EMERGENCY' ? 'border-rose-500 animate-pulse' :
                sosState === '1ST_PRESS_DETECTED' ? 'border-amber-400 animate-pulse' :
                sosState === 'EMERGENCY_CANCELLED' ? 'border-emerald-500' :
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

                {/* OLED SCREEN STATE: 1. NORMAL */}
                {sosState === 'NORMAL' && (
                  <div className="space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300">
                      <ShieldAlert className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
                      GUARDIANBAND
                    </p>
                    <p className="text-[11px] text-emerald-400 font-mono font-bold">
                      STATE: NORMAL
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Click SOS button 2 times to trigger emergency
                    </p>
                  </div>
                )}

                {/* OLED SCREEN STATE: 2. 1ST PRESS DETECTED */}
                {sosState === '1ST_PRESS_DETECTED' && (
                  <div className="space-y-1 animate-pulse">
                    <div className="w-8 h-8 mx-auto rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] font-mono font-bold text-amber-300 uppercase">
                      1st SOS PRESS DETECTED!
                    </p>
                    <p className="text-[10px] text-white font-bold leading-tight">
                      Click SOS button 2nd time to confirm
                    </p>
                    <p className="text-[10px] text-amber-400 font-mono font-bold">
                      Window: {confirmCountdown}s remaining
                    </p>
                  </div>
                )}

                {/* OLED SCREEN STATE: 3. 15-SECOND TIMER (ARE YOU SAFE?) */}
                {sosState === 'COUNTDOWN_15S' && (
                  <div className="space-y-1">
                    <p className="text-xs font-black tracking-widest text-rose-400 uppercase animate-pulse">
                      ARE YOU SAFE?
                    </p>
                    <div className="text-5xl font-mono font-black text-white drop-shadow-md">
                      {countdown}
                    </div>
                    <p className="text-[9px] text-amber-300 uppercase font-bold">
                      PRESS SOS 3rd TIME TO CANCEL
                    </p>
                    <p className="text-[8px] text-slate-400">
                      No 3rd press = VERIFIED EMERGENCY
                    </p>

                    <div className="pt-1 flex items-center gap-1.5 justify-center">
                      <button
                        onClick={handleThirdPressCancel}
                        className="px-3 py-1 text-[10px] font-bold rounded-full bg-emerald-600 hover:bg-emerald-500 text-white transition-transform active:scale-95 cursor-pointer shadow"
                      >
                        3rd Press: CANCEL
                      </button>
                    </div>
                  </div>
                )}

                {/* OLED SCREEN STATE: 4. VERIFIED EMERGENCY */}
                {sosState === 'VERIFIED_EMERGENCY' && (
                  <div className="space-y-1.5">
                    <div className="w-9 h-9 mx-auto rounded-full bg-rose-500 text-white flex items-center justify-center animate-pulse">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-black tracking-wider text-rose-500 uppercase">
                      🚨 VERIFIED SOS
                    </p>
                    <p className="text-[9px] text-slate-200 font-mono leading-tight">
                      SIM800L SMS & GPRS Dispatched
                    </p>
                    <p className="text-[9px] text-cyan-400 font-mono">
                      Continuous GPS Tracking Active
                    </p>
                  </div>
                )}

                {/* OLED SCREEN STATE: 5. EMERGENCY CANCELLED */}
                {sosState === 'EMERGENCY_CANCELLED' && (
                  <div className="space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-emerald-400 uppercase">
                      EMERGENCY CANCELLED
                    </p>
                    <p className="text-[10px] text-slate-400">
                      3rd Press detected within 15s. Returning to NORMAL.
                    </p>
                  </div>
                )}

                {/* Bottom Screen Device ID */}
                <div className="absolute bottom-3 text-[9px] font-mono text-slate-500">
                  {deviceId} • {trackingStatus === 'ACTIVE' ? '🛰️ TRACKING' : 'IDLE'}
                </div>
              </div>

              {/* Physical Tactile SOS Button on Bezel Right */}
              <button
                onClick={handleSOSPress}
                title={
                  sosState === 'NORMAL' ? '1st SOS Press: Click to start emergency' :
                  sosState === '1ST_PRESS_DETECTED' ? '2nd SOS Press: Click to confirm and start 15s timer' :
                  sosState === 'COUNTDOWN_15S' ? '3rd SOS Press: Click to CANCEL emergency' :
                  'Emergency Active'
                }
                className={`absolute -right-3.5 top-1/2 -translate-y-1/2 w-8 h-16 rounded-r-lg bg-gradient-to-r transition-all border-t border-b border-r shadow-lg flex items-center justify-center cursor-pointer select-none group ${
                  sosState === 'COUNTDOWN_15S'
                    ? 'from-emerald-600 to-amber-600 animate-pulse border-amber-300 ring-4 ring-amber-500/50 scale-105'
                    : sosState === '1ST_PRESS_DETECTED'
                    ? 'from-amber-600 to-rose-600 animate-pulse border-amber-300 ring-4 ring-amber-500/50 scale-105'
                    : 'from-rose-700 to-rose-600 hover:from-rose-600 border-rose-400 active:scale-95'
                }`}
              >
                <div className="rotate-90 text-[9px] font-black tracking-widest text-white uppercase group-hover:scale-110 transition-transform">
                  {sosState === 'COUNTDOWN_15S' ? 'CANCEL' : 'SOS'}
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
              title="Immediately initiate 15s timer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>⚡ TEST 15s TIMER</span>
            </button>

            {sosState === 'COUNTDOWN_15S' && (
              <button
                onClick={handleThirdPressCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold cursor-pointer shadow transition animate-pulse"
                title="Test 3rd Press Cancel within 15 seconds"
              >
                <Check className="w-3.5 h-3.5" />
                <span>3rd PRESS (CANCEL)</span>
              </button>
            )}

            <button
              onClick={handleResetToNormal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition cursor-pointer border border-slate-700"
              title="Reset device simulator to NORMAL state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET TO NORMAL</span>
            </button>
          </div>

          {/* Hardware Instruction Badge */}
          <div className="mt-3 bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-400 max-w-xs text-center space-y-0.5 font-mono">
            <p className="font-semibold text-slate-200">Hardware SOS Protocol:</p>
            <p>1. 1st Press: detected immediately.</p>
            <p>2. 2nd Press within 5s: starts 15s safety timer.</p>
            <p>3. 3rd Press within 15s: cancels emergency $\rightarrow$ NORMAL.</p>
            <p>4. No 3rd Press for 15s: auto VERIFIED EMERGENCY.</p>
          </div>
        </div>

        {/* =================================================================== */}
        {/* HARDWARE BENCH & SENSOR CONTROLS (7 COLS)                          */}
        {/* =================================================================== */}
        <div className="lg:col-span-7 space-y-5">

          {/* SYSTEM TERMINAL STATUS DISPLAY */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs shadow-md">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2 mb-2">
              <span className="flex items-center gap-1.5 font-bold text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                <span>SIMULATOR STATUS BUS</span>
              </span>
              <span className="text-[10px] text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40 font-bold">
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

          {/* ================================================================= */}
          {/* A. ESP32 LOCAL STORAGE (Flash / NVS Storage Card)                  */}
          {/* ================================================================= */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>ESP32 Local Storage (Non-Volatile NVS Flash)</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
                PERSISTENT ON-CHIP
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              {/* User Info */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold block">1. USER INFO</span>
                <p className="text-white font-bold">{storedUser.name} ({storedUser.age}y, {storedUser.gender})</p>
                <p className="text-slate-400 text-[11px]">Blood: <b className="text-rose-400">{storedUser.bloodGroup}</b> | {storedUser.medicalNotes}</p>
              </div>

              {/* Device ID */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold block">2. DEVICE ID</span>
                <p className="text-cyan-400 font-bold text-sm">{deviceId}</p>
                <p className="text-slate-400 text-[11px]">User ID: <span className="text-slate-300">{userId}</span></p>
              </div>

              {/* Emergency Contact */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold block">3. EMERGENCY CONTACT</span>
                <p className="text-emerald-400 font-bold">{storedEmergencyContact.phone}</p>
                <p className="text-slate-400 text-[11px]">{storedEmergencyContact.name} ({storedEmergencyContact.relation})</p>
              </div>

              {/* User Dashboard / Tracking URL */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] font-bold block">4. USER DASHBOARD / TRACKING URL</span>
                <p className="text-purple-300 font-bold truncate text-[11px]">{storedTrackingUrl}</p>
                <p className="text-slate-500 text-[10px]">Embedded in SIM800L SMS Alert</p>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* B. SENSORS (GPS Location & MAX30102 Biosensor)                     */}
          {/* ================================================================= */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Sensors (GPS Location + MAX30102 HR/SpO2)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">UART + I2C BUS</span>
            </div>

            {/* Biosensor Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Heart Rate */}
              <div className="space-y-2 bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-400" /> MAX30102 Heart Rate:
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
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    Normal (75)
                  </button>
                  <button
                    onClick={() => handleUpdateHealthTelemetry(135, spo2)}
                    className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40 cursor-pointer"
                  >
                    Distress (135)
                  </button>
                </div>
              </div>

              {/* SpO2 */}
              <div className="space-y-2 bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" /> MAX30102 Blood Oxygen:
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
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    Normal (98%)
                  </button>
                  <button
                    onClick={() => handleUpdateHealthTelemetry(heartRate, 89)}
                    className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/40 cursor-pointer"
                  >
                    Hypoxia (89%)
                  </button>
                </div>
              </div>
            </div>

            {/* GPS Location Details */}
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>GPS Location:</span>
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    onClick={() => requestRealLocation()}
                    disabled={isLocating}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={() => { setLocationSource('REAL_BROWSER'); requestRealLocation(); }}
                    className={`px-2 py-0.5 rounded cursor-pointer ${locationSource === 'REAL_BROWSER' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'}`}
                  >
                    Browser GPS
                  </button>
                  <button
                    onClick={() => { setLocationSource('SIMULATED_LOCAL'); setLatitude(routeWaypoints[0].lat); setLongitude(routeWaypoints[0].lng); }}
                    className={`px-2 py-0.5 rounded cursor-pointer ${locationSource === 'SIMULATED_LOCAL' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'}`}
                  >
                    Campus Route
                  </button>
                </div>
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
          </div>

          {/* ================================================================= */}
          {/* C. SIM800L CELLULAR ENGINE (Dual Path: SMS to Contacts & GPRS to Backend) */}
          {/* ================================================================= */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2 text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                <Radio className="w-4 h-4 text-amber-400" />
                <span>SIM800L Cellular Dispatch Engine</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
                GSM / GPRS 2G/4G
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              {/* Path 1: SIM800L SMS */}
              <div className={`p-3 rounded-lg border transition ${
                sim800lSmsStatus === 'SENT_TO_CONTACTS' ? 'bg-emerald-950/40 border-emerald-500' :
                sim800lSmsStatus === 'DISPATCHING' ? 'bg-amber-950/40 border-amber-500 animate-pulse' :
                'bg-slate-950/70 border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>SIM800L SMS</span>
                  </span>
                  <span className={`text-[10px] font-bold ${
                    sim800lSmsStatus === 'SENT_TO_CONTACTS' ? 'text-emerald-400' :
                    sim800lSmsStatus === 'DISPATCHING' ? 'text-amber-400' : 'text-slate-500'
                  }`}>
                    {sim800lSmsStatus === 'SENT_TO_CONTACTS' ? 'DISPATCHED' : sim800lSmsStatus === 'DISPATCHING' ? 'SENDING...' : 'STANDBY'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Target: <b className="text-white">{storedEmergencyContact.phone}</b></p>
                <p className="text-[10px] text-slate-500 mt-1">Direct SMS with Wearer info, Google Maps link, Tracking URL, and Sensor vitals.</p>
              </div>

              {/* Path 2: SIM800L GPRS */}
              <div className={`p-3 rounded-lg border transition ${
                sim800lGprsStatus === 'DELIVERED_TO_BACKEND' ? 'bg-cyan-950/40 border-cyan-500' :
                sim800lGprsStatus === 'TRANSMITTING' ? 'bg-amber-950/40 border-amber-500 animate-pulse' :
                'bg-slate-950/70 border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                    <span>SIM800L GPRS</span>
                  </span>
                  <span className={`text-[10px] font-bold ${
                    sim800lGprsStatus === 'DELIVERED_TO_BACKEND' ? 'text-cyan-400' :
                    sim800lGprsStatus === 'TRANSMITTING' ? 'text-amber-400' : 'text-slate-500'
                  }`}>
                    {sim800lGprsStatus === 'DELIVERED_TO_BACKEND' ? 'DELIVERED' : sim800lGprsStatus === 'TRANSMITTING' ? 'POSTING...' : 'STANDBY'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Target: <b className="text-white">Node.js Backend & Firebase</b></p>
                <p className="text-[10px] text-slate-500 mt-1">HTTP POST payload $\rightarrow$ Firebase $\rightarrow$ Central Dashboard $\rightarrow$ Police Control Room.</p>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* D. CONTINUOUS LOCATION MONITORING CONTROLS                        */}
          {/* ================================================================= */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2 font-bold text-white uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>Continuous Location Monitoring (3s Interval)</span>
              </span>
              <span className={`text-[10px] font-bold ${isStreamingGps ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>
                {isStreamingGps ? `ACTIVE (${streamingPingCount} pings)` : 'IDLE'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSendManualLocation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer transition border border-slate-700"
              >
                <Send className="w-3.5 h-3.5 text-cyan-400" />
                <span>Send Single GPS Ping</span>
              </button>

              {isStreamingGps ? (
                <button
                  onClick={stopGpsStreaming}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition shadow animate-pulse"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop Continuous Stream</span>
                </button>
              ) : (
                <button
                  onClick={() => startGpsStreaming()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer transition shadow"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Continuous Location Stream (3s)</span>
                </button>
              )}
            </div>
          </div>

          {/* ================================================================= */}
          {/* E. BATTERY & HARDWARE CONDITIONS                                  */}
          {/* ================================================================= */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2 font-bold text-white uppercase tracking-wider">
                <Battery className="w-4 h-4 text-amber-400" />
                <span>Battery & Cellular Conditions</span>
              </span>
              <span className="text-xs text-amber-400 font-bold">{battery}%</span>
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

              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
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
                  Cellular: {cellularConnected ? 'SIM800L 4G ONLINE' : 'DISCONNECTED'}
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

export default App;
