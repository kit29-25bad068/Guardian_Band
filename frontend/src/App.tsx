import React, { useState, useEffect } from 'react';
import { PoliceControlRoom } from './pages/PoliceControlRoom';
import { CentralDashboard } from './pages/CentralDashboard';
import { UserGuardianPortal } from './pages/UserGuardianPortal';
import { DeviceSimulator } from './pages/DeviceSimulator';
import { NetworkHub } from './pages/NetworkHub';
import { audioAlert } from './utils/audioAlert';

export type SiteId = 'POLICE' | 'CENTRAL' | 'GUARDIAN' | 'SIMULATOR' | 'HUB';

export function resolveSiteFromLocation(): SiteId {
  const path = window.location.pathname.toLowerCase();
  const search = new URLSearchParams(window.location.search);
  const param = (search.get('site') || search.get('view') || search.get('portal'))?.toLowerCase();

  if (path.startsWith('/police') || param === 'police') return 'POLICE';
  if (path.startsWith('/central') || param === 'central') return 'CENTRAL';
  if (path.startsWith('/guardian') || path.startsWith('/portal') || param === 'guardian' || param === 'portal') return 'GUARDIAN';
  if (path.startsWith('/simulator') || param === 'simulator') return 'SIMULATOR';
  if (path === '/hub' || param === 'hub') return 'HUB';

  // Root '/' defaults to the 4-website Network Hub & Directory
  return 'HUB';
}

export const App: React.FC = () => {
  const [activeSite, setActiveSite] = useState<SiteId>(() => resolveSiteFromLocation());

  useEffect(() => {
    // Unconditionally unlock Web Audio API on first user interaction anywhere
    const handleFirstGesture = () => {
      audioAlert.unlock();
    };
    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });

    // Handle browser Forward / Back buttons
    const handlePopState = () => {
      setActiveSite(resolveSiteFromLocation());
    };
    window.addEventListener('popstate', handlePopState);

    // Smooth client-side navigation for internal links
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (target) {
        const href = target.getAttribute('href');
        if (href && href.startsWith('/') && !target.hasAttribute('target') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          window.history.pushState({}, '', href);
          setActiveSite(resolveSiteFromLocation());
          window.scrollTo(0, 0);
        }
      }
    };
    document.addEventListener('click', handleDocumentClick);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  // Render the selected standalone website
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-cyan-500 selection:text-white">
      {activeSite === 'POLICE' && <PoliceControlRoom />}
      {activeSite === 'CENTRAL' && <CentralDashboard />}
      {activeSite === 'GUARDIAN' && <UserGuardianPortal />}
      {activeSite === 'SIMULATOR' && <DeviceSimulator />}
      {activeSite === 'HUB' && <NetworkHub />}
    </div>
  );
};

export default App;
