import React, { useState, useEffect } from 'react';
import { api, socket } from '../services/api';
import type { SystemStats } from '../types';
import { 
  Siren, LayoutDashboard, UserCheck, Watch, 
  ExternalLink, Zap, ShieldAlert, 
  Layers, ArrowRight, Activity
} from 'lucide-react';

export const NetworkHub: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);

  useEffect(() => {
    document.title = 'GuardianBand | Multi-Website Network Hub';
    api.getStats().then(setStats).catch(() => {});

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const handleLaunchAllFour = () => {
    const screenW = window.screen.availWidth || 1920;
    const screenH = window.screen.availHeight || 1080;
    const halfW = Math.floor(screenW / 2);
    const halfH = Math.floor(screenH / 2);

    // 1. Device Simulator (Top Left)
    window.open(
      '/simulator',
      'GB_Simulator_Win',
      `left=0,top=0,width=${halfW},height=${halfH},resizable=yes,scrollbars=yes`
    );

    // 2. Central Dashboard (Top Right)
    window.open(
      '/central',
      'GB_Central_Win',
      `left=${halfW},top=0,width=${halfW},height=${halfH},resizable=yes,scrollbars=yes`
    );

    // 3. Police Control Room (Bottom Left)
    window.open(
      '/police',
      'GB_Police_Win',
      `left=0,top=${halfH},width=${halfW},height=${halfH},resizable=yes,scrollbars=yes`
    );

    // 4. Guardian Portal (Bottom Right)
    window.open(
      '/guardian',
      'GB_Guardian_Win',
      `left=${halfW},top=${halfH},width=${halfW},height=${halfH},resizable=yes,scrollbars=yes`
    );
  };

  const websites = [
    {
      id: 'POLICE',
      title: 'Police Control Room Website',
      category: 'LAW ENFORCEMENT & 911 DISPATCH',
      path: '/police',
      icon: Siren,
      gradient: 'from-rose-600 to-red-800',
      borderColor: 'hover:border-rose-500/80',
      badge: 'CRITICAL OPS',
      badgeBg: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      headline: 'Dedicated EOC Tactical Emergency Station',
      description: 'The official police and emergency services portal. Receives real-time AI-escalated SOS alarms, displays wearer identity & medical notes, sounds an audible siren, tracks live GPS coordinates on dark radar maps, and manages police dispatch lifecycle (Acknowledge → Dispatch → Resolve).',
      features: [
        'Automatic AI emergency escalation without human delay',
        'Tactical Dark Radar & Google Maps with live breadcrumbs',
        'Vital signs telemetry HUD (Heart Rate, SpO2, Battery)',
        'Audible dual-tone speaker siren on verified distress'
      ]
    },
    {
      id: 'CENTRAL',
      title: 'Central Control Dashboard Website',
      category: 'OPERATIONS & WEARABLE FLEET COMMAND',
      path: '/central',
      icon: LayoutDashboard,
      gradient: 'from-cyan-600 to-blue-800',
      borderColor: 'hover:border-cyan-500/80',
      badge: 'CENTRAL OPS',
      badgeBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      headline: 'Bi-Directional Telemetry & Remote Command Center',
      description: 'The mission-critical central command center. Monitors wearable telemetry, real-time health biosensors (MAX30102), and connection status. Features an interactive remote control console to dispatch commands directly to the wearable (Request Location, Start/Stop Tracking, Test SOS, Reset Device).',
      features: [
        'Live bi-directional command transmitter to wearable',
        'Continuous health monitoring (HR BPM, Blood Oxygen SpO2)',
        'Live interactive tracking map with moving marker',
        'Real-time connection bus status & audit trail'
      ]
    },
    {
      id: 'GUARDIAN',
      title: 'Guardian & Wearer Portal Website',
      category: 'CIVILIAN & FAMILY SAFETY PORTAL',
      path: '/guardian',
      icon: UserCheck,
      gradient: 'from-emerald-600 to-teal-800',
      borderColor: 'hover:border-emerald-500/80',
      badge: 'PERSONAL SAFETY',
      badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      headline: 'Wearer Identity, Emergency Contacts & SMS Hub',
      description: 'The personal civilian portal for Priya Sharma and her emergency contacts. Displays linked smart band status, blood group, allergies, medical notes, past incident history, and provides SMS Gateway integration to broadcast distress text messages to relatives.',
      features: [
        'Linked smart wearable status & battery telemetry',
        'Emergency contact management & relationship directory',
        'SMSLocal Gateway integration with live test simulator',
        'Personal distress map & high-precision location locator'
      ]
    },
    {
      id: 'SIMULATOR',
      title: 'Device Simulator Website',
      category: 'ESP32 HARDWARE MODEL & SIMULATION',
      path: '/simulator',
      icon: Watch,
      gradient: 'from-purple-600 to-indigo-800',
      borderColor: 'hover:border-purple-500/80',
      badge: 'HARDWARE BENCH',
      badgeBg: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      headline: 'Virtual Smartwatch Bezel & Sensor Test Bench',
      description: 'The virtual software counterpart to the physical ESP32 wearable. Features an authentic smartwatch OLED bezel, the 2-stage 5-second deliberate hold SOS trigger, the 15-second "ARE YOU SAFE?" safety verification countdown, MAX30102 health sliders, and a multi-mode GPS engine.',
      features: [
        'Authentic 2-stage 5-second deliberate hold SOS trigger',
        '15-second safety timer with "ARE YOU SAFE?" verification',
        'MAX30102 Biosensor sliders (Heart Rate & SpO2)',
        'Multi-mode GPS: Real Browser GPS, Campus Route & Quick Pins'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white p-4 md:p-8">
      
      {/* TOP HEADER */}
      <header className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/90 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600 via-blue-700 to-indigo-800 flex items-center justify-center shadow-xl shadow-cyan-950/60 border border-cyan-500/40">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl md:text-2xl font-black tracking-wider text-white">
                GUARDIANBAND
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
                NETWORK HUB
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Autonomous Smart SOS Wearable & Emergency Response Ecosystem • 4 Standalone Websites
            </p>
          </div>
        </div>

        {/* Status Indicators & Master Launch Button */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className="text-slate-300">Backend Port 5000:</span>
            <span className={isConnected ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
              {isConnected ? 'ONLINE' : 'RECONNECTING'}
            </span>
          </div>

          <button
            onClick={handleLaunchAllFour}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-mono font-bold transition cursor-pointer shadow-xl shadow-indigo-950/60 border border-purple-400/30"
          >
            <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
            <span>🚀 LAUNCH ALL 4 WEBSITES SIDE-BY-SIDE</span>
          </button>
        </div>
      </header>

      {/* MAIN HUB BODY */}
      <main className="max-w-7xl mx-auto w-full my-8 space-y-8 flex-1">
        
        {/* ARCHITECTURE OVERVIEW BANNER */}
        <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
                  Distributed 4-Website Architecture
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white">
                Four Independent Systems Interconnected in Real Time
              </h2>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                The GuardianBand platform is split into 4 distinct standalone websites. Each website operates independently for its specific role, while staying synchronized with sub-second latency through the Node.js + Socket.IO real-time event bus.
              </p>
            </div>

            {/* Quick Live Stats Pill */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto shrink-0 font-mono text-xs">
              <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Active SOS</span>
                <span className="text-lg font-black text-rose-500">{stats?.activeEmergencies ?? 0}</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Online Devices</span>
                <span className="text-lg font-black text-emerald-400">{stats?.onlineDevices ?? 1}</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 uppercase block">Total Users</span>
                <span className="text-lg font-black text-cyan-400">{stats?.totalUsers ?? 1}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 WEBSITES SHOWCASE GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {websites.map((site) => {
            const IconComponent = site.icon;

            return (
              <div
                key={site.id}
                className={`bg-slate-900/70 border border-slate-800/90 rounded-2xl p-6 transition flex flex-col justify-between hover:shadow-2xl ${site.borderColor}`}
              >
                <div>
                  {/* Card Top */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${site.gradient} flex items-center justify-center text-white shadow-lg`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 block tracking-wider uppercase">
                          {site.category}
                        </span>
                        <h3 className="text-lg font-bold text-white font-mono">{site.title}</h3>
                        <span className="text-xs font-mono text-cyan-400">{site.path}</span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${site.badgeBg}`}>
                      {site.badge}
                    </span>
                  </div>

                  {/* Headline & Description */}
                  <h4 className="text-sm font-semibold text-slate-200 mt-2">
                    {site.headline}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-4">
                    {site.description}
                  </p>

                  {/* Bullet Highlights */}
                  <div className="space-y-1.5 border-t border-slate-800/80 pt-3">
                    {site.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center gap-3 pt-6 mt-4 border-t border-slate-800/80">
                  <a
                    href={site.path}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition cursor-pointer border border-slate-700 hover:border-cyan-500/50"
                  >
                    <span>Open Website</span>
                    <ArrowRight className="w-4 h-4 text-cyan-400" />
                  </a>

                  <button
                    onClick={() => window.open(site.path, '_blank')}
                    className="py-2.5 px-4 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/60 text-cyan-300 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                    title="Open in a separate standalone window"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">New Window</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>

        {/* END-TO-END FLOW VISUALIZER */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <span>Real-Time Cross-Website Workflow</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-purple-400 font-bold block">1. DEVICE SIMULATOR</span>
              <p className="text-slate-300 text-[11px]">
                Wearer triggers 2-stage 5s deliberate hold $\rightarrow$ 15s "ARE YOU SAFE?" countdown begins.
              </p>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-cyan-400 font-bold block">2. CENTRAL DASHBOARD</span>
              <p className="text-slate-300 text-[11px]">
                Monitors device state $\rightarrow$ transitions to VERIFYING $\rightarrow$ dispatches remote commands.
              </p>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-rose-400 font-bold block">3. POLICE CONTROL ROOM</span>
              <p className="text-slate-300 text-[11px]">
                Receives automated AI escalation with live Heart Rate, SpO2, Battery, Location and sounds siren.
              </p>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-emerald-400 font-bold block">4. GUARDIAN PORTAL</span>
              <p className="text-slate-300 text-[11px]">
                Notifies family emergency contacts via SMS and streams live breadcrumb tracking map.
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto w-full border-t border-slate-800/80 pt-4 text-center text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>GuardianBand Emergency System • 4 Standalone Websites Integrated via Node.js + Socket.IO</span>
        <span>Routes: /police • /central • /guardian • /simulator</span>
      </footer>

    </div>
  );
};
