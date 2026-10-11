/**
 * INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS
 * Biometric Visitor Management & Automated Biosecurity Gate Decision System
 * Entry Point Component
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/common/Navbar';
import { GateScannerView } from './components/gate/GateScannerView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { OfflineSyncBar } from './components/common/OfflineSyncBar';
import { User } from './types';
import { ShieldCheck } from 'lucide-react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { apiUrl, resolveAssetUrl } from './lib/api';

const INITIAL_USERS: User[] = [
  {
    id: 'usr_001',
    username: 'gate_operator',
    email: 'gate1.security@colcom.co.zw',
    fullName: 'Tendai Moyo (Guard Sgt.)',
    role: 'GATE_OPERATOR',
    mfaEnabled: false,
    gateAssigned: 'MAIN_BIOSECURITY_GATE_01',
  },
  {
    id: 'usr_002',
    username: 'admin',
    email: 'biosecurity@colcom.co.zw',
    fullName: 'Dr. Sarah Ndlovu (Chief Vet & Biosecurity Officer)',
    role: 'BIOSECURITY_OFFICER',
    mfaEnabled: false,
    gateAssigned: 'HEADQUARTERS_OPS_CENTER',
  },
  {
    id: 'usr_003',
    username: 'sec_manager',
    email: 'security.mgr@colcom.co.zw',
    fullName: 'David Chimuti (Security Operations Manager)',
    role: 'SECURITY_MANAGER',
    mfaEnabled: false,
    gateAssigned: 'ALL_FACILITIES',
  },
  {
    id: 'usr_004',
    username: 'auditor',
    email: 'auditor.innscor@innscorafrica.com',
    fullName: 'Grace Katsande (Group Risk Auditor)',
    role: 'AUDITOR',
    mfaEnabled: false,
    gateAssigned: 'INNSCOR_CORPORATE',
  },
];

function AppInner() {
  const { theme } = useTheme();
  const [currentView, setCurrentView] = useState<'GATE' | 'ADMIN'>('GATE');
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]);
  const [systemUsers, setSystemUsers] = useState<User[]>(INITIAL_USERS);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    // Fetch users
    fetch(apiUrl('/api/users'))
      .then((res) => (res.ok ? res.json() : INITIAL_USERS))
      .then((users) => {
        setSystemUsers(users);
        if (users.length > 0 && !currentUser) {
          setCurrentUser(users[0]);
        }
      })
      .catch(() => {
        // Fallback
      });

    // Fetch initial settings for logo
    fetch(apiUrl('/api/settings'))
      .then((res) => (res.ok ? res.json() : null))
      .then((settings) => {
        if (settings && settings.logoUrl) {
          setLogoUrl(resolveAssetUrl(settings.logoUrl));
        }
      })
      .catch(() => {});

    // Listen to SSE for real-time logo/settings updates
    const eventSource = new EventSource(apiUrl('/api/events'));
    eventSource.addEventListener('settings_updated', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.logoUrl !== undefined) {
          setLogoUrl(resolveAssetUrl(payload.logoUrl));
        }
      } catch (err) {
        console.error(err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, []);

  const handleSwitchUser = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'GATE_OPERATOR') {
      setCurrentView('GATE');
    } else {
      setCurrentView('ADMIN');
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-emerald-500 selection:text-white ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Top Navbar with Dynamic Logo & Theme Switcher */}
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        currentUser={currentUser}
        logoUrl={logoUrl}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4">
        {/* Offline Sync Bar */}
        <OfflineSyncBar />

        {/* View Switch Display */}
        {currentView === 'GATE' ? (
          <div className="space-y-4">
            <GateScannerView logoUrl={logoUrl} />
          </div>
        ) : (
          <AdminDashboard
            currentUser={currentUser}
            onSwitchRole={handleSwitchUser}
            systemUsers={systemUsers}
            onExitAdmin={() => setCurrentView('GATE')}
            logoUrl={logoUrl}
            onLogoChange={setLogoUrl}
          />
        )}
      </main>

      {/* Official Footer with Innscor & Colcom Title */}
      <footer className={`border-t py-4 px-6 text-center text-xs transition-colors ${
        theme === 'dark'
          ? 'border-slate-900 bg-slate-950 text-slate-400'
          : 'border-slate-200 bg-white text-slate-600'
      }`}>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="font-bold text-slate-200">
            INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
