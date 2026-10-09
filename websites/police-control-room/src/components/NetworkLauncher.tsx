import React, { useState } from 'react';
import { 
  Globe, Siren, LayoutDashboard, UserCheck, Watch, 
  ExternalLink, X, Zap, ChevronRight, Layers 
} from 'lucide-react';

interface NetworkLauncherProps {
  currentSite?: 'POLICE' | 'CENTRAL' | 'GUARDIAN' | 'SIMULATOR' | 'HUB';
}

export const NetworkLauncher: React.FC<NetworkLauncherProps> = ({ currentSite }) => {
  const [isOpen, setIsOpen] = useState(false);

  const websites = [
    {
      id: 'POLICE',
      name: 'Police Emergency Control Room',
      shortName: 'Police Control Room',
      path: 'http://localhost:5174',
      portUrl: 'http://localhost:5174',
      icon: Siren,
      themeColor: 'from-rose-600 to-red-800',
      badgeBg: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      description: 'Tactical 911 EOC station for incident dispatch, vital signs HUD, audio siren alarm, and automatic AI escalation.',
      role: 'Emergency Dispatchers & Law Enforcement'
    },
    {
      id: 'CENTRAL',
      name: 'Central Control Dashboard',
      shortName: 'Central Dashboard',
      path: 'http://localhost:5173',
      portUrl: 'http://localhost:5173',
      icon: LayoutDashboard,
      themeColor: 'from-cyan-600 to-blue-800',
      badgeBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      description: 'Autonomous central fleet operations, live biosensor telemetry, interactive map, remote wearable commands & audit logs.',
      role: 'Operations & Fleet Command'
    },
    {
      id: 'GUARDIAN',
      name: 'Guardian & Wearer Portal',
      shortName: 'Guardian Portal',
      path: 'http://localhost:5175',
      portUrl: 'http://localhost:5175',
      icon: UserCheck,
      themeColor: 'from-emerald-600 to-teal-800',
      badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      description: 'Civilian wearable portal with wearer medical profile, live distress tracking, SMS gateway & emergency contacts.',
      role: 'Wearer & Family Emergency Contacts'
    },
    {
      id: 'SIMULATOR',
      name: 'Wearable Device Simulator',
      shortName: 'Device Simulator',
      path: 'http://localhost:5176',
      portUrl: 'http://localhost:5176',
      icon: Watch,
      themeColor: 'from-purple-600 to-indigo-800',
      badgeBg: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      description: 'Virtual ESP32 smartwatch hardware model with 2-stage 5s deliberate hold SOS, 15s countdown, MAX30102 biosensors & GPS.',
      role: 'Hardware Testing & Demonstration'
    }
  ];

  const handleOpenSite = (targetUrl: string, newWindow: boolean = false) => {
    if (newWindow) {
      window.open(targetUrl, '_blank');
    } else {
      window.location.href = targetUrl;
    }
    setIsOpen(false);
  };

  const handleLaunchAllFour = () => {
    // Open 4 distinct windows sized and positioned across the screen
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

    setIsOpen(false);
  };

  return (
    <>
      {/* TRIGGER BUTTON */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-mono font-bold transition cursor-pointer shadow hover:border-cyan-500/50"
        title="Switch or launch any of the 4 GuardianBand websites"
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
                      DISTRIBUTED ECOSYSTEM
                    </span>
                    <span className="text-xs text-slate-400 font-mono">4 STANDALONE WEBSITES</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mt-0.5">
                    GuardianBand Multi-Website Network
                  </h2>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Launch All Banner */}
            <div className="bg-gradient-to-r from-purple-950/70 via-indigo-950/70 to-slate-900/90 border border-purple-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-purple-300">
                  <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
                  <span>DEMO & TEST MODE: FULL ECOSYSTEM</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Open all 4 websites in 4 tiled windows side-by-side to watch the complete end-to-end emergency flow in real time.
                </p>
              </div>

              <button
                onClick={handleLaunchAllFour}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-mono font-bold transition cursor-pointer shadow-lg shadow-purple-950/60 flex items-center gap-2 shrink-0"
              >
                <span>🚀 LAUNCH ALL 4 WEBSITES</span>
              </button>
            </div>

            {/* 4 Websites Grid */}
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
                            <span className="text-[10px] font-mono text-slate-400">{site.path}</span>
                          </div>
                        </div>

                        {isCurrent ? (
                          <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 px-2 py-0.5 rounded">
                            CURRENT
                          </span>
                        ) : (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${site.badgeBg}`}>
                            STANDALONE
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed mt-2">
                        {site.description}
                      </p>

                      <div className="mt-2 text-[11px] font-mono text-slate-500">
                        Target Audience: <b className="text-slate-400">{site.role}</b>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-4 mt-3 border-t border-slate-800/80">
                      <button
                        onClick={() => handleOpenSite(site.portUrl, false)}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          isCurrent
                            ? 'bg-slate-800 text-slate-400 cursor-default'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                        disabled={isCurrent}
                      >
                        <span>Open Here</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenSite(site.portUrl, true)}
                        className="py-1.5 px-3 rounded-lg text-xs font-mono font-bold bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/60 text-cyan-300 flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                        title="Open in a separate browser window/tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>New Window</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-800/80 pt-3 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-500 gap-2">
              <span>All 4 websites communicate in real time through the shared Node.js + Socket.IO server on port 5000.</span>
              <button
                onClick={() => handleOpenSite('http://localhost:5000/', false)}
                className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                Go to Network Hub Directory
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
