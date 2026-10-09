import React, { useState, useEffect } from 'react';
import { api, socket } from './services/api';
import type { User, Device, Emergency, SMSConfig, SMSLog } from './types';
import { EmergencyMap } from './components/EmergencyMap';
import { NetworkLauncher } from './components/NetworkLauncher';
import { 
  ShieldCheck, ShieldAlert, Battery, Radio, MapPin, Clock, 
  User as UserIcon, RefreshCw, Phone, UserPlus, Edit3, Check, Navigation, Crosshair, X, Shield,
  MessageSquare, Send, Settings, AlertTriangle, Smartphone
} from 'lucide-react';
import { reverseGeocode } from './utils/geoUtils';

export const App: React.FC = () => {
  const [currentUserId, setCurrentUserId] = useState<string>('USER-1024');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [activeEmergency, setActiveEmergency] = useState<Emergency | null>(null);

  // Emergency Contacts Modal State
  const [showContactModal, setShowContactModal] = useState(false);
  const [primaryName, setPrimaryName] = useState('');
  const [primaryRelation, setPrimaryRelation] = useState('Parent');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [secondaryName, setSecondaryName] = useState('');
  const [secondaryRelation, setSecondaryRelation] = useState('Friend');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [contactSuccessMsg, setContactSuccessMsg] = useState<string | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // SMS Gateway State
  const [smsConfig, setSmsConfig] = useState<SMSConfig | null>(null);
  const [smsLogs, setSmsLogs] = useState<SMSLog[]>([]);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smslocalApiKey, setSmslocalApiKey] = useState('');
  const [smslocalSenderId, setSmslocalSenderId] = useState('');
  const [smslocalTemplateId, setSmslocalTemplateId] = useState('');
  const [smslocalMessageTemplate, setSmslocalMessageTemplate] = useState('');
  const [isSavingSmsConfig, setIsSavingSmsConfig] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);
  const [testPhoneInput, setTestPhoneInput] = useState('');
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);

  // Real Geolocation Sync State
  const [isLocating, setIsLocating] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);

  const loadUserData = async (uid: string) => {
    try {
      const [u, d, emgs] = await Promise.all([
        api.getUser(uid),
        api.getUserDevice(uid),
        api.getUserEmergencies(uid)
      ]);
      setUser(u);
      setDevice(d);
      setEmergencies(emgs);

      const active = emgs.find(e => e.status !== 'RESOLVED' && e.status !== 'CANCELLED') || null;
      setActiveEmergency(active);
    } catch (err) {
      console.error('Failed to load user portal data:', err);
    }
  };

  const handleOpenContactModal = () => {
    setPrimaryName(user?.emergencyContact?.name || '');
    setPrimaryRelation(user?.emergencyContact?.relation || 'Parent');
    setPrimaryPhone(user?.emergencyContact?.phone || '');
    setSecondaryName(user?.secondaryContact?.name || '');
    setSecondaryRelation(user?.secondaryContact?.relation || 'Friend');
    setSecondaryPhone(user?.secondaryContact?.phone || '');
    setContactSuccessMsg(null);
    setShowContactModal(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryName.trim() || !primaryPhone.trim()) {
      alert('Primary guardian name and phone number are required.');
      return;
    }

    setIsSavingContact(true);
    try {
      const payload: {
        name: string;
        relation: string;
        phone: string;
        secondaryContact?: { name: string; relation: string; phone: string };
      } = {
        name: primaryName.trim(),
        relation: primaryRelation.trim(),
        phone: primaryPhone.trim()
      };

      if (secondaryName.trim() && secondaryPhone.trim()) {
        payload.secondaryContact = {
          name: secondaryName.trim(),
          relation: secondaryRelation.trim(),
          phone: secondaryPhone.trim()
        };
      }

      const updatedUser = await api.updateEmergencyContact(currentUserId, payload);
      setUser(updatedUser);
      setContactSuccessMsg('Emergency contacts saved! Real-time update transmitted to Police Control Room.');
      setTimeout(() => {
        setShowContactModal(false);
        setContactSuccessMsg(null);
      }, 1300);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to save emergency contact: ${msg}`);
    } finally {
      setIsSavingContact(false);
    }
  };

  const fetchSmsData = async () => {
    try {
      const res = await api.getSMSStatus();
      setSmsConfig(res.config);
      setSmsLogs(res.recentLogs || []);
      if (res.config) {
        if (res.config.senderId) setSmslocalSenderId(res.config.senderId);
        if (res.config.templateId) setSmslocalTemplateId(res.config.templateId);
        if (res.config.messageTemplate) setSmslocalMessageTemplate(res.config.messageTemplate);
      }
    } catch (err) {
      console.warn('Failed to load SMS status:', err);
    }
  };

  const handleOpenSmsModal = () => {
    setShowSmsModal(true);
    setSmsFeedback(null);
    if (user?.emergencyContact?.phone && !testPhoneInput) {
      setTestPhoneInput(user.emergencyContact.phone);
    }
  };

  const handleSaveSmsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSmsConfig(true);
    setSmsFeedback(null);
    try {
      const res = await api.updateSMSConfig({
        apiKey: smslocalApiKey,
        senderId: smslocalSenderId,
        templateId: smslocalTemplateId,
        messageTemplate: smslocalMessageTemplate
      });
      setSmsConfig(res.config);
      setSmsFeedback(`✅ ${res.message}`);
      fetchSmsData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSmsFeedback(`❌ Error saving SMS settings: ${msg}`);
    } finally {
      setIsSavingSmsConfig(false);
    }
  };

  const handleSendTestSMS = async (targetPhone?: string) => {
    const phoneToTest = targetPhone || testPhoneInput || user?.emergencyContact?.phone;
    if (!phoneToTest) {
      alert('Please enter a phone number or configure an emergency contact first.');
      return;
    }

    setIsSendingTestSms(true);
    setSmsFeedback(null);
    try {
      const res = await api.sendTestSMS({
        phone: phoneToTest,
        recipientName: user?.emergencyContact?.name || user?.name || 'Guardian',
        userId: currentUserId
      });
      setSmsFeedback(`✅ ${res.message}`);
      fetchSmsData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSmsFeedback(`❌ Test SMS Failed: ${msg}`);
    } finally {
      setIsSendingTestSms(false);
    }
  };

  const handleSyncCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationFeedback('Detecting your live browser GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy);

        // High precision structured reverse geocoding
        const resolvedAddr = await reverseGeocode(lat, lng);

        try {
          if (device?.deviceId) {
            await api.deviceSendLocation({
              deviceId: device.deviceId,
              userId: currentUserId,
              latitude: lat,
              longitude: lng,
              address: resolvedAddr,
              token: device.token
            });
          }
          setDevice(prev => prev ? { ...prev, latitude: lat, longitude: lng, address: resolvedAddr } : null);
          setLocationFeedback(`📍 Location synced to your real GPS: ${resolvedAddr} (±${acc}m accuracy)`);
          setTimeout(() => setLocationFeedback(null), 6000);
        } catch (err) {
          console.warn('Failed to send location:', err);
          setLocationFeedback(`Location acquired, but sync to server failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        setLocationFeedback(`⚠️ Geolocation error: ${err.message}. Please allow location access in your browser.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    document.title = 'GuardianBand | Guardian & Wearer Portal';
    api.getUsers().then(setAllUsers).catch(() => {});
    loadUserData(currentUserId);
    fetchSmsData();

    // Socket listeners
    const handleNew = (payload: { emergency: Emergency }) => {
      if (payload.emergency.userId === currentUserId) {
        setActiveEmergency(payload.emergency);
        setEmergencies(prev => [payload.emergency, ...prev]);
      }
    };

    const handleLocation = (payload: { emergencyId: string; location: { latitude: number; longitude: number; address?: string; timestamp: string } }) => {
      setActiveEmergency((prev) => {
        if (prev && prev.emergencyId === payload.emergencyId) {
          return {
            ...prev,
            latitude: payload.location.latitude,
            longitude: payload.location.longitude,
            address: payload.location.address || prev.address,
            locationHistory: [...(prev.locationHistory || []), payload.location]
          };
        }
        return prev;
      });
    };

    const handleStatus = (payload: { emergency: Emergency }) => {
      if (payload.emergency.userId === currentUserId) {
        setEmergencies(prev => prev.map(e => e.emergencyId === payload.emergency.emergencyId ? payload.emergency : e));
        if (payload.emergency.status === 'RESOLVED' || payload.emergency.status === 'CANCELLED') {
          setActiveEmergency(null);
        } else {
          setActiveEmergency(payload.emergency);
        }
      }
    };

    const handleSMS = (payload: { sms: SMSLog }) => {
      setSmsLogs(prev => [payload.sms, ...prev]);
    };

    socket.on('emergency:new', handleNew);
    socket.on('emergency:location_update', handleLocation);
    socket.on('emergency:status_change', handleStatus);
    socket.on('sms:dispatched', handleSMS);

    return () => {
      socket.off('emergency:new', handleNew);
      socket.off('emergency:location_update', handleLocation);
      socket.off('emergency:status_change', handleStatus);
      socket.off('sms:dispatched', handleSMS);
    };
  }, [currentUserId]);

  const isDistressActive = !!activeEmergency;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Header & User Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              GUARDIAN SAFETY VIEW
            </span>
            <span className="text-xs text-slate-400 font-mono">SECURE PROTECTED PORTAL</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">
            Guardian & User Safety Portal
          </h1>
        </div>

        {/* User Profile Selector (Demo Mode Convenience) */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-mono">PROFILE:</label>
          <select
            value={currentUserId}
            onChange={(e) => {
              setCurrentUserId(e.target.value);
              loadUserData(e.target.value);
            }}
            className="bg-slate-900 border border-slate-700 text-white text-xs font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            {allUsers.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.name} ({u.userId} - {u.deviceId})
              </option>
            ))}
          </select>
          <button
            onClick={() => loadUserData(currentUserId)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <NetworkLauncher currentSite="GUARDIAN" />
        </div>
      </div>

      {/* EMERGENCY DISTRESS BANNER IF ACTIVE */}
      {isDistressActive ? (
        <div className="bg-gradient-to-r from-rose-900/90 via-red-900 to-rose-950 border-2 border-rose-500 rounded-2xl p-5 shadow-2xl animate-pulse text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white text-rose-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-7 h-7 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/20 uppercase">
                  {activeEmergency.priority} PRIORITY
                </span>
                <span className="text-xs font-mono">{activeEmergency.emergencyId}</span>
              </div>
              <h2 className="text-lg font-black uppercase tracking-wide mt-0.5">
                ACTIVE SOS DISTRESS SIGNAL VERIFIED
              </h2>
              <p className="text-xs text-rose-100 font-mono">
                Police Control Room notified automatically • Live location streaming enabled
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-xs bg-black/30 px-3 py-2 rounded-xl border border-white/10">
            <p className="text-rose-200">POLICE STATUS:</p>
            <p className="text-sm font-bold text-white uppercase">{activeEmergency.status}</p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-400">All Clear — Wearer Safe</p>
              <p className="text-xs text-slate-400">No active distress alerts recorded for {user?.name || currentUserId}.</p>
            </div>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800/40">
            STATUS: SAFE
          </span>
        </div>
      )}

      {/* WEARABLE HEALTH & TELEMETRY ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Device ID */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-mono text-slate-400 uppercase">Paired Wearable</p>
          <p className="text-xl font-black font-mono text-white mt-1">{device?.deviceId || '...'}</p>
          <p className="text-[10px] text-slate-500 font-mono mt-1">Firmware: {device?.firmwareVersion || 'v2.4.1'}</p>
        </div>

        {/* Battery */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-mono text-slate-400 uppercase">Device Battery</p>
          <div className="flex items-center gap-2 mt-1">
            <Battery className={`w-5 h-5 ${Number(device?.battery) < 20 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`} />
            <span className="text-xl font-black font-mono text-white">{device?.battery ?? 84}%</span>
          </div>
          <p className="text-[10px] text-emerald-400 font-mono mt-1">Battery Optimal</p>
        </div>

        {/* Connectivity */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-mono text-slate-400 uppercase">Cellular Link</p>
          <div className="flex items-center gap-2 mt-1">
            <Radio className="w-5 h-5 text-emerald-400" />
            <span className="text-xl font-black font-mono text-white">
              {device?.cellularStatus === 'CONNECTED' ? '4G LTE' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-1">Direct Modem Feed</p>
        </div>

        {/* GPS Fix */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-mono text-slate-400 uppercase">GPS Navigation</p>
          <div className="flex items-center gap-2 mt-1">
            <MapPin className="w-5 h-5 text-cyan-400" />
            <span className="text-xl font-black font-mono text-white">
              {device?.gpsStatus === 'AVAILABLE' ? 'LOCKED' : 'NO FIX'}
            </span>
          </div>
          <p className="text-[10px] text-cyan-400 font-mono mt-1">Continuous Geolocation</p>
        </div>
      </div>

      {/* LIVE LOCATION MAP */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-2">
          <span className="font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            {isDistressActive ? '🚨 LIVE DISTRESS LOCATION TRACKING' : 'LATEST KNOWN LOCATION'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
              {device?.address || 'Locating device...'}
            </span>
            <button
              onClick={handleSyncCurrentLocation}
              disabled={isLocating}
              title="Detect your real browser GPS and update the device location"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer transition text-[11px] shadow disabled:opacity-50"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{isLocating ? 'Acquiring GPS...' : '📍 Sync to My Live GPS'}</span>
            </button>
          </div>
        </div>

        {locationFeedback && (
          <div className="bg-cyan-950/80 border border-cyan-800/80 px-3 py-1.5 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{locationFeedback}</span>
          </div>
        )}

        <EmergencyMap
          latitude={activeEmergency?.latitude ?? device?.latitude ?? 10.9993}
          longitude={activeEmergency?.longitude ?? device?.longitude ?? 77.0842}
          address={activeEmergency?.address || device?.address}
          emergencyId={activeEmergency?.emergencyId}
          userId={user?.name || currentUserId}
          locationHistory={activeEmergency?.locationHistory || []}
          height="350px"
        />
      </div>

      {/* DUAL PANELS: USER SAFETY PROFILE + EMERGENCY HISTORY */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* User Profile & Emergency Contact (5 Cols) */}
        <div className="md:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 text-xs font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-white font-bold">
              <UserIcon className="w-4 h-4 text-cyan-400" />
              <span>Registered Wearer Profile</span>
            </div>
            <button
              onClick={handleOpenContactModal}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition cursor-pointer text-[11px]"
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit Contacts</span>
            </button>
          </div>

          <div className="space-y-2">
            <div><span className="text-slate-500">Full Name:</span> <span className="text-white font-bold">{user?.name}</span></div>
            <div><span className="text-slate-500">Phone:</span> <span className="text-slate-300">{user?.phone}</span></div>
            <div><span className="text-slate-500">Email:</span> <span className="text-slate-300">{user?.email}</span></div>
            <div><span className="text-slate-500">Address:</span> <span className="text-slate-300">{user?.address}</span></div>
            <div><span className="text-slate-500">Blood Group:</span> <span className="text-rose-400 font-bold">{user?.bloodGroup || 'O+'}</span></div>
            <div><span className="text-slate-500">Medical Notes:</span> <span className="text-slate-300">{user?.medicalNotes || 'None'}</span></div>
          </div>

          {/* Emergency Contacts Section */}
          <div className="border-t border-slate-800 pt-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Emergency Contacts
              </span>
              <button
                onClick={handleOpenContactModal}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer flex items-center gap-1 font-bold"
              >
                <UserPlus className="w-3 h-3" />
                <span>+ Manage Contacts</span>
              </button>
            </div>

            {user?.emergencyContact ? (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-rose-400">🛡️ Primary Guardian</span>
                  <span className="text-[10px] text-emerald-400 font-bold">Auto-Notified on SOS</span>
                </div>
                <p className="text-white font-bold text-sm">{user.emergencyContact.name}</p>
                <p className="text-slate-400 text-[11px]">Relationship: <span className="text-slate-200">{user.emergencyContact.relation}</span></p>
                <a href={`tel:${user.emergencyContact.phone}`} className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-bold pt-0.5 text-xs">
                  <Phone className="w-3 h-3" />
                  <span>{user.emergencyContact.phone}</span>
                </a>
              </div>
            ) : (
              <div className="bg-amber-950/20 border border-amber-800/40 rounded-lg p-3 text-center space-y-2">
                <p className="text-amber-400 font-bold text-xs">No Emergency Contact Configured!</p>
                <p className="text-slate-400 text-[11px]">GuardianBand needs at least one emergency contact to notify when SOS verifies.</p>
                <button
                  onClick={handleOpenContactModal}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Primary Guardian
                </button>
              </div>
            )}

            {user?.secondaryContact && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-400">Secondary Contact</span>
                <p className="text-white font-bold">{user.secondaryContact.name}</p>
                <p className="text-slate-400 text-[11px]">Relationship: <span className="text-slate-200">{user.secondaryContact.relation}</span></p>
                <a href={`tel:${user.secondaryContact.phone}`} className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-bold pt-0.5 text-xs">
                  <Phone className="w-3 h-3" />
                  <span>{user.secondaryContact.phone}</span>
                </a>
              </div>
            )}

            {/* SMS Carrier Gateway Status & Quick Actions */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                  SMS Carrier Gateway
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  smsConfig?.isConfigured 
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' 
                    : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                }`}>
                  {smsConfig?.isConfigured ? '🟢 Live SMS Active' : '⚠️ Simulation Mode'}
                </span>
              </div>

              <p className="text-[10px] text-slate-400 leading-normal">
                {smsConfig?.isConfigured
                  ? `Delivering real cellular SMS via SMSLocal DLT Gateway (${smsConfig.senderId || 'Carrier Link'}).`
                  : 'Web software requires a telecom gateway (SMSLocal) to route SMS to physical mobile phones.'}
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOpenSmsModal}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition cursor-pointer text-[11px] font-bold flex items-center justify-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  <span>{smsConfig?.isConfigured ? 'Gateway Settings' : 'Configure SMSLocal'}</span>
                </button>
                {user?.emergencyContact?.phone && (
                  <button
                    type="button"
                    onClick={() => handleSendTestSMS(user.emergencyContact.phone)}
                    disabled={isSendingTestSms}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition cursor-pointer text-[11px] font-bold flex items-center gap-1 disabled:opacity-50"
                    title="Send a test SMS to the primary guardian's number"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isSendingTestSms ? 'Sending...' : 'Test SMS'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Alert History (7 Cols) */}
        <div className="md:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-white font-bold font-mono text-sm">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Incident & Alert History</span>
            </div>
            <span className="text-xs font-mono text-slate-400">{emergencies.length} Events</span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {emergencies.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono py-8 text-center">No previous emergency records.</p>
            ) : (
              emergencies.map((emg) => (
                <div
                  key={emg.emergencyId}
                  className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{emg.emergencyId}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        emg.status === 'NEW' ? 'bg-rose-600 text-white' :
                        emg.status === 'RESOLVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' :
                        'bg-cyan-950 text-cyan-400 border border-cyan-800/40'
                      }`}>
                        {emg.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(emg.triggerTime).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-slate-400 text-[11px]">
                    {emg.aiReport?.summary || `Emergency verified via ${emg.verificationMethod}. Escalate to Police.`}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                    <span>Coordinates: {emg.latitude?.toFixed(4)}, {emg.longitude?.toFixed(4)}</span>
                    <span className="text-cyan-400">{emg.dispatchedUnit || 'Police EOC Notified'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* OUTBOUND CELLULAR SMS DISPATCH MONITOR */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center border border-cyan-800/40">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Outbound SMS & Cellular Alert Dispatch Monitor</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  smsConfig?.isConfigured 
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' 
                    : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                }`}>
                  {smsConfig?.isConfigured ? '🟢 Live Carrier (SMSLocal)' : '⚠️ Simulation Mode'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Automatic distress SMS notifications dispatched to wearers' emergency contacts upon verified SOS.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenSmsModal}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-bold cursor-pointer flex items-center gap-1.5 transition"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Gateway Settings</span>
            </button>
            <button
              onClick={fetchSmsData}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer"
              title="Refresh SMS logs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Explain why real SMS requires carrier API */}
        {!smsConfig?.isConfigured && (
          <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3.5 flex items-start gap-3 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-slate-300 text-[11px] leading-relaxed">
              <p className="font-bold text-amber-300">Why didn't an SMS arrive on your phone?</p>
              <p>
                Browsers and local web servers running on a PC cannot broadcast cellular radio waves directly to mobile telecom towers (Airtel, Jio, Vi, BSNL). 
                To send an actual SMS text message to your physical mobile phone, connect an <strong>SMS Gateway provider (SMSLocal)</strong>.
              </p>
              <p className="text-slate-400">
                Click <strong>"Gateway Settings"</strong> to enter SMSLocal credentials. In the meantime, the system simulates and logs all outbound dispatches below in real time.
              </p>
            </div>
          </div>
        )}

        {/* Live SMS Log Entries */}
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {smsLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              No emergency SMS dispatched yet. When you trigger and verify an SOS, alerts will be transmitted and logged here live.
            </div>
          ) : (
            smsLogs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{log.recipientName}</span>
                    <span className="text-slate-400 text-[11px]">({log.recipientRelation})</span>
                    <span className="text-cyan-400 font-mono text-[11px] font-bold">{log.to}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      log.status === 'SENT_TO_CARRIER'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                        : log.status === 'SIMULATED_LOCAL'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                        : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                    }`}>
                      {log.status === 'SENT_TO_CARRIER' ? '✅ Carrier Delivered' : log.status === 'SIMULATED_LOCAL' ? '🟡 Simulation Queued' : '❌ Failed'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 text-[11px] text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">
                  {log.message}
                </div>

                {log.error && (
                  <div className="space-y-1.5 pt-0.5">
                    <p className="text-[10px] text-amber-400/90 font-mono flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Gateway Notice: {log.error}</span>
                    </p>
                    {log.error.includes('102') && (
                      <div className="bg-amber-950/40 border border-amber-800/40 rounded-lg p-2 text-[10px] text-slate-300 font-sans leading-normal flex items-start justify-between gap-2">
                        <span>
                          💡 <strong>How to resolve:</strong> <code>GDBAND</code> is an unapproved placeholder. Go to <strong>smslocal.in</strong> &gt; <strong>Sender IDs (Headers)</strong>, find your approved 6-character Header, and enter it in Gateway Settings.
                        </span>
                        <button
                          type="button"
                          onClick={handleOpenSmsModal}
                          className="shrink-0 px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer text-[9px]"
                        >
                          Fix Sender ID
                        </button>
                      </div>
                    )}
                    {log.error.includes('110') && (
                      <div className="bg-amber-950/40 border border-amber-800/40 rounded-lg p-2 text-[10px] text-slate-300 font-sans leading-normal">
                        💡 <strong>How to resolve:</strong> Verify that your numeric DLT Template ID and message text match the approved DLT template in your SMSLocal dashboard.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* EMERGENCY CONTACTS MANAGEMENT MODAL */}
      {showContactModal && (
        <div className="fixed inset-0 z-[3000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Manage Wearer Emergency Contacts</span>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-slate-400 hover:text-white text-base cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300 text-[11px] leading-relaxed">
              When GuardianBand verifies an SOS distress signal, these registered contacts are transmitted automatically to the **Police Control Room** alongside real-time GPS telemetry.
            </p>

            {contactSuccessMsg && (
              <div className="bg-emerald-950/80 border border-emerald-800 px-3 py-2 rounded-lg text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{contactSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveContact} className="space-y-4">
              {/* PRIMARY CONTACT (MANDATORY) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-rose-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1">
                    <span>🛡️ Primary Guardian (Required)</span>
                  </span>
                  <span className="text-[10px] text-slate-500">First line responder</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={primaryName}
                      onChange={(e) => setPrimaryName(e.target.value)}
                      placeholder="e.g. Mark Jenkins"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Relationship *</label>
                    <select
                      value={primaryRelation}
                      onChange={(e) => setPrimaryRelation(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500 text-xs"
                    >
                      <option value="Parent">Parent (Mother / Father)</option>
                      <option value="Spouse">Spouse / Partner</option>
                      <option value="Sibling">Sibling (Brother / Sister)</option>
                      <option value="Child">Son / Daughter</option>
                      <option value="Doctor">Physician / Doctor</option>
                      <option value="Friend">Trusted Friend</option>
                      <option value="Guardian">Legal Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Phone Number (with Country Code) *</label>
                  <input
                    type="tel"
                    required
                    value={primaryPhone}
                    onChange={(e) => setPrimaryPhone(e.target.value)}
                    placeholder="e.g. +1 (555) 234-5678 or +91 9876543210"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500 text-xs font-mono"
                  />
                </div>
              </div>

              {/* SECONDARY CONTACT (OPTIONAL) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                    Secondary Contact (Optional)
                  </span>
                  <span className="text-[10px] text-slate-500">Backup notification</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Full Name</label>
                    <input
                      type="text"
                      value={secondaryName}
                      onChange={(e) => setSecondaryName(e.target.value)}
                      placeholder="e.g. Dr. Robert Chen"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Relationship</label>
                    <select
                      value={secondaryRelation}
                      onChange={(e) => setSecondaryRelation(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500 text-xs"
                    >
                      <option value="Doctor">Family Doctor</option>
                      <option value="Friend">Close Friend</option>
                      <option value="Parent">Parent</option>
                      <option value="Spouse">Spouse / Partner</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Neighbor">Neighbor</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={secondaryPhone}
                    onChange={(e) => setSecondaryPhone(e.target.value)}
                    placeholder="e.g. +1 (555) 987-6543"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingContact}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer text-xs shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingContact ? 'Saving...' : 'Save Emergency Contacts'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SMSLOCAL SMS GATEWAY CONFIGURATION MODAL */}
      {showSmsModal && (
        <div className="fixed inset-0 z-[3000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl font-mono text-xs my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Cellular SMS Gateway Setup (SMSLocal)</span>
              </div>
              <button
                onClick={() => setShowSmsModal(false)}
                className="text-slate-400 hover:text-white text-base cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanatory Guide */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-[11px] space-y-2 text-slate-300 font-sans leading-relaxed">
              <p className="font-bold text-cyan-300 font-mono">📡 Why is an SMS Gateway needed?</p>
              <p>
                Local computer software and web apps have no physical cellular radio transmitter or SIM card to connect to telecom towers.
                To deliver actual text messages to real iPhones/Android phones (Airtel, Jio, Vi, BSNL), the platform bridges through <strong>SMSLocal's Indian telecom DLT gateway</strong>.
              </p>
              <div className="bg-cyan-950/40 border border-cyan-800/40 p-2.5 rounded-lg text-slate-400 text-[10px] space-y-1 font-mono">
                <p className="text-cyan-300 font-bold">Quick SMSLocal Setup Steps:</p>
                <p>1. Log in to your account at <span className="text-white underline">smslocal.in</span>.</p>
                <p>2. Copy your <strong>API Key</strong> from your SMSLocal Dashboard.</p>
                <p>3. Enter your approved 6-character <strong>Sender ID</strong> (Header) & DLT <strong>Template ID</strong>.</p>
                <p>4. <em>Note:</em> SMSLocal dispatches to Indian mobile numbers via Route 1 (Transactional/DLT).</p>
              </div>
            </div>

            {smsFeedback && (
              <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                smsFeedback.startsWith('✅') 
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' 
                  : 'bg-rose-950/80 border-rose-800 text-rose-300'
              }`}>
                <span className="shrink-0">{smsFeedback.startsWith('✅') ? '✅' : '⚠️'}</span>
                <span>{smsFeedback}</span>
              </div>
            )}

            {/* Gateway Credentials Form */}
            <form onSubmit={handleSaveSmsConfig} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">SMSLocal API Key</label>
                  <input
                    type="password"
                    value={smslocalApiKey}
                    onChange={(e) => setSmslocalApiKey(e.target.value)}
                    placeholder={smsConfig?.apiKeyMasked || "Enter your SMSLocal API Key"}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Sender ID (6-char Header)</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={smslocalSenderId}
                      onChange={(e) => setSmslocalSenderId(e.target.value.toUpperCase())}
                      placeholder={smsConfig?.senderId || "Approved 6-char Header"}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 text-xs font-mono uppercase"
                    />
                    <span className="text-[9px] text-amber-400/90 block mt-1">
                      ⚠️ Must match your approved 6-char Header in smslocal.in
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">DLT Template ID</label>
                    <input
                      type="text"
                      value={smslocalTemplateId}
                      onChange={(e) => setSmslocalTemplateId(e.target.value)}
                      placeholder={smsConfig?.templateId || "e.g. 1207161729384918273"}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 text-xs font-mono"
                    />
                    <span className="text-[9px] text-slate-500 block mt-1">
                      Approved numeric DLT template ID from SMSLocal
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-slate-400 block">Approved Message Template Format (Optional)</label>
                    <span className="text-[9px] text-cyan-400/80">Supports &#123;userId&#125;, &#123;location&#125;, &#123;time&#125;, &#123;coordinates&#125;, &#123;mapUrl&#125;</span>
                  </div>
                  <textarea
                    rows={3}
                    value={smslocalMessageTemplate}
                    onChange={(e) => setSmslocalMessageTemplate(e.target.value)}
                    placeholder="Enter custom approved DLT template if your account uses specific text..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 text-[11px] font-mono leading-relaxed resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSmsModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer text-xs"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSavingSmsConfig}
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer text-xs shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingSmsConfig ? 'Validating...' : 'Save & Activate Gateway'}</span>
                </button>
              </div>
            </form>

            {/* Test Phone Section */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-amber-400 font-bold uppercase text-[11px] flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  Test Carrier SMS Delivery
                </span>
                <span className="text-[10px] text-slate-500">Verify phone reaches carrier</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="tel"
                  value={testPhoneInput}
                  onChange={(e) => setTestPhoneInput(e.target.value)}
                  placeholder="Enter mobile number to test (e.g. +91 9876543210)"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleSendTestSMS(testPhoneInput)}
                  disabled={isSendingTestSms}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer text-xs transition shadow flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingTestSms ? 'Sending...' : 'Send Test SMS'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
