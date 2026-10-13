import React, { useState, useEffect } from 'react';
import { 
  Globe, Siren, LayoutDashboard, UserCheck, Watch, 
  ExternalLink, X, Zap, ChevronRight, Layers, Server, Check, RefreshCw, Link as LinkIcon
} from 'lucide-react';
import { getBackendUrl, setBackendUrl, socket } from '../services/api';

interface NetworkLauncherProps {
  currentSite?: 'POLICE' | 'CENTRAL' | 'GUARDIAN' | 'SIMULATOR';
}

// Resolver for each separate website's URL
export function getSiteUrl(siteId: 'POLICE' | 'CENTRAL' | 'GUARDIAN' | 'SIMULATOR', currentSite?: string): string {
  if (typeof window !== 'undefined') {
    if (siteId === currentSite) {
      return window.location.origin;
    }
    const saved = localStorage.getItem(`GB_URL_${siteId}`);
    if (saved) return saved;
  }

  switch (siteId) {
    case 'POLICE':
      return import.meta.env.VITE_POLICE_URL || 'http://localhost:5174';
    case 'CENTRAL':
      return import.meta.env.VITE_CENTRAL_URL || 'http://localhost:5173';
    case 'GUARDIAN':
      return import.meta.env.VITE_GUARDIAN_URL || 'http://localhost:5175';
    case 'SIMULATOR':
      return import.meta.env.VITE_SIMULATOR_URL || 'http://localhost:5176';
  }
}

export function saveSiteUrl(siteId: 'POLICE' | 'CENTRAL' | 'GUARDIAN' | 'SIMULATOR', url: string) {
  if (typeof window !== 'undefined') {
    if (url.trim()) {
      localStorage.setItem(`GB_URL_${siteId}`, url.trim().replace(/\/$/, ''));
    } else {
      localStorage.removeItem(`GB_URL_${siteId}`);
    }
  }
}

export const NetworkLauncher: React.FC<NetworkLauncherProps> = ({ currentSite }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [backendInput, setBackendInput] = useState(() => getBackendUrl());
  const [isSaved, setIsSaved] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);

  const [policeUrlInput, setPoliceUrlInput] = useState(() => getSiteUrl('POLICE', currentSite));
  const [centralUrlInput, setCentralUrlInput] = useState(() => getSiteUrl('CENTRAL', currentSite));
  const [guardianUrlInput, setGuardianUrlInput] = useState(() => getSiteUrl('GUARDIAN', currentSite));
  const [simulatorUrlInput, setSimulatorUrlInput] = useState(() => getSiteUrl('SIMULATOR', currentSite));

  useEffect(() => {
    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const websites = [
    {
      id: 'POLICE' as const,
      name: 'Police Emergency Control Room',
      shortName: 'Police Control Room',
      url: getSiteUrl('POLICE', currentSite),
      icon: Siren,
      themeColor: 'from-rose-600 to-red-800',
      badgeBg: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      description: 'Tactical 911 EOC station for incident dispatch, vital signs HUD, audio siren alarm, and automatic AI escalation.',
      role: 'Emergency Dispatchers & Law Enforcement'
    },
    {
      id: 'CENTRAL' as const,
      name: 'Central Control Dashboard',
      shortName: 'Central Dashboard',
      url: getSiteUrl('CENTRAL', currentSite),
      icon: LayoutDashboard,
      themeColor: 'from-cyan-600 to-blue-800',
      badgeBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      description: 'Autonomous central fleet operations, live biosensor telemetry, interactive map, remote wearable commands & audit logs.',
      role: 'Operations & Fleet Command'
    },
    {
      id: 'GUARDIAN' as const,
      name: 'Guardian & Wearer Portal',
      shortName: 'Guardian Portal',
      url: getSiteUrl('GUARDIAN', currentSite),
      icon: UserCheck,
      themeColor: 'from-emerald-600 to-teal-800',
      badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      description: 'Civilian wearable portal with wearer medical profile, live distress tracking, SMS gateway & emergency contacts.',
      role: 'Wearer & Family Emergency Contacts'
    },
    {
      id: 'SIMULATOR' as const,
      name: 'Wearable Device Simulator',
      shortName: 'Device Simulator',
      url: getSiteUrl('SIMULATOR', currentSite),
      icon: Watch,
      themeColor: 'from-purple-600 to-indigo-800',
      badgeBg: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      description: 'Virtual ESP32 smartwatch hardware model with 3-stage SOS trigger, 15s timer, MAX30102 biosensors & GPS.',
      role: 'Hardware Testing & Wearer Simulation'
    }
  ];

  const handleSaveBackend = (e: React.FormEvent) => {
    e.preventDefault();
    setBackendUrl(backendInput);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleResetBackend = () => {
    setBackendInput('');
    setBackendUrl('');
  };

  const handleSaveUrls = (e: React.FormEvent) => {
    e.preventDefault();
    saveSiteUrl('POLICE', policeUrlInput);
    saveSiteUrl('CENTRAL', centralUrlInput);
    saveSiteUrl('GUARDIAN', guardianUrlInput);
    saveSiteUrl('SIMULATOR', simulatorUrlInput);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setShowConfig(false);
    }, 1200);
  };

  const handleOpenSite = (targetUrl: string, newWindow: boolean = false) => {
    if (newWindow) {
      window.open(targetUrl, '_blank');
    } else {
      window.location.href = targetUrl;
    }
    setIsOpen(false);
  };

  const handleLaunchAllFour = () => {
    const screenW = window.screen.availWidth || 1920;
    const screenH = window.screen.availHeight || 1080;
    const halfW = Math.floor(screenW / 2);
    const halfH = Math.floor(screenH / 2);

    window.open(
      getSiteUrl('SIMULATOR', currentSite),
      'GB_Simulator_Win',
      `left=0,top=0,width=${halfW},height=${halfH},resizable=yes,scrollbars=yes`
    );

    window.open(
      getSiteUrl('CENTRAL', currentSite),
      'GB_Central_Win',
      `left=${halfW},top=0,width=${halfW},height=${halfH},resizable=yes,scrollbars=yes`
    );

    window.open(
      getSiteUrl('POLICE', currentSite),
      'GB_Police_Win',
      `left=0,top=${halfH},width=${halfW},height=${halfH},resizable=yes,scrollbars=yes`
    );

    window.open(
      getSiteUrl('GUARDIAN', currentSite),
      'GB_Guardian_Win',
      `left=${halfW},top=${halfH},width=${halfW},height=${halfH},resizable=yes,scrollbars=yes`
    );

    setIsOpen(false);
  };

  return (
    <>
      {/* TRIGGER BUTTON */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-mono font-bold transition cursor-pointer shadow hover:border-cyan-500/50"
        title="Switch to any of the 4 interconnected websites"
      >
        <Globe className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline">4 WEBSITES NETWORK</span>
        <span className="sm:hidden">NETWORK</span>
      </button>

      {/* MODAL OVERLAY */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0b1120] border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-slate-100 flex flex-col gap-5">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-800 flex items-center justify-center shadow-lg shadow-cyan-950/50 border border-cyan-500/40">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                      INTERCONNECTED NETWORK
                    </span>
                    <span className="text-xs text-slate-400 font-mono">4 DEDICATED WEBSITES</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mt-0.5">
                    GuardianBand Distributed Ecosystem
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition cursor-pointer ${
                    showConfig 
                      ? 'bg-cyan-950 text-cyan-400 border-cyan-700' 
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800'
                  }`}
                  title="Configure URLs for the 4 separate websites"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">URL Settings</span>
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Launch All Banner */}
            <div className="bg-gradient-to-r from-purple-950/70 via-indigo-950/70 to-slate-900/90 border border-purple-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-purple-300">
                  <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
                  <span>INTERCONNECTED DEMO: OPEN ALL 4 WEBSITES</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Launch each website in its own tiled browser window. Trigger an SOS on the Device Simulator to see it broadcast instantly to Central and Police Control in real time.
                </p>
              </div>

              <button
                onClick={handleLaunchAllFour}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-mono font-bold transition cursor-pointer shadow-lg shadow-purple-950/60 flex items-center gap-2 shrink-0"
              >
                <span>🚀 LAUNCH ALL 4 WEBSITES</span>
              </button>
            </div>

            {/* URL Configuration Drawer (If Opened) */}
            {showConfig && (
              <form onSubmit={handleSaveUrls} className="bg-slate-950/90 border border-cyan-800/60 rounded-xl p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                    Configure Live URLs for the 4 Separate Websites
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Paste your Vercel or local URLs below so cross-website links jump directly:
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <label className="text-slate-400 block mb-1">🚔 Police Control Room URL:</label>
                    <input
                      type="text"
                      value={policeUrlInput}
                      onChange={(e) => setPoliceUrlInput(e.target.value)}
                      placeholder="http://localhost:5174 or https://police.vercel.app"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">🖥️ Central Dashboard URL:</label>
                    <input
                      type="text"
                      value={centralUrlInput}
                      onChange={(e) => setCentralUrlInput(e.target.value)}
                      placeholder="http://localhost:5173 or https://central.vercel.app"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">🛡️ Guardian Portal URL:</label>
                    <input
                      type="text"
                      value={guardianUrlInput}
                      onChange={(e) => setGuardianUrlInput(e.target.value)}
                      placeholder="http://localhost:5175 or https://guardian.vercel.app"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">⌚ Device Simulator URL:</label>
                    <input
                      type="text"
                      value={simulatorUrlInput}
                      onChange={(e) => setSimulatorUrlInput(e.target.value)}
                      placeholder="http://localhost:5176 or https://simulator.vercel.app"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition flex items-center gap-1"
                  >
                    {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{isSaved ? 'URLs Saved!' : 'Save Website URLs'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* 4 Websites Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {websites.map((site) => {
                const IconComponent = site.icon;
                const isCurrent = currentSite === site.id;

                return (
                  <div
                    key={site.id}
                    className={`rounded-xl p-4 border transition flex flex-col justify-between ${
                      isCurrent 
                        ? 'bg-slate-900/90 border-cyan-500/60 shadow-lg shadow-cyan-950/40' 
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${site.themeColor} flex items-center justify-center text-white shadow`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white font-mono">{site.shortName}</h3>
                            <span className="text-[10px] font-mono text-cyan-400 truncate block max-w-[200px]" title={site.url}>
                              {site.url}
                            </span>
                          </div>
                        </div>

                        {isCurrent ? (
                          <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 px-2 py-0.5 rounded animate-pulse">
                            THIS WEBSITE
                          </span>
                        ) : (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${site.badgeBg}`}>
                            STANDALONE SITE
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed mt-2">
                        {site.description}
                      </p>

                      <div className="mt-2 text-[11px] font-mono text-slate-500">
                        Designated For: <b className="text-slate-400">{site.role}</b>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-4 mt-3 border-t border-slate-800/80">
                      <button
                        onClick={() => handleOpenSite(site.url, false)}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          isCurrent
                            ? 'bg-slate-800 text-slate-400 cursor-default'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                        disabled={isCurrent}
                      >
                        <span>{isCurrent ? 'Current Website' : 'Go to Website'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenSite(site.url, true)}
                        className="py-1.5 px-3 rounded-lg text-xs font-mono font-bold bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/60 text-cyan-300 flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                        title="Open in a separate browser window/tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>New Tab</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Shared Backend Connection Bar (Interconnection Engine) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                  isSocketConnected 
                    ? 'bg-emerald-500/20 border-emerald-500/30' 
                    : 'bg-amber-500/20 border-amber-500/30'
                }`}>
                  <Server className={`w-4 h-4 ${isSocketConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-mono font-bold text-slate-200">Shared Real-Time Event Bus</h4>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                      isSocketConnected 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}>
                      {isSocketConnected ? 'CONNECTED' : 'STANDALONE MODE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {backendInput ? `Backend: ${backendInput}` : 'All 4 websites synchronize events through this server URL.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveBackend} className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="text"
                  value={backendInput}
                  onChange={(e) => setBackendInput(e.target.value)}
                  placeholder="https://your-backend.onrender.com"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-full md:w-64"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold shrink-0 transition flex items-center gap-1 cursor-pointer"
                >
                  {isSaved ? <Check className="w-3.5 h-3.5 text-white" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>{isSaved ? 'Saved' : 'Sync All'}</span>
                </button>
                {backendInput && (
                  <button
                    type="button"
                    onClick={handleResetBackend}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-mono shrink-0 transition cursor-pointer"
                    title="Reset to local backend"
                  >
                    Reset
                  </button>
                )}
              </form>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-800/80 pt-3 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-500 gap-2">
              <span>Each of the 4 websites runs autonomously, interconnected via the central Socket.IO WebSocket bus.</span>
              <span className="text-cyan-400">
                Active Website: <b>{currentSite || 'STANDALONE'}</b>
              </span>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
