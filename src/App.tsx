/**
 * Colcom Foods (Triple C Pigs) - African Swine Fever Biometric Access & Gate Decision System
 * Entry Point Component
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/common/Navbar';
import { GateScannerView } from './components/gate/GateScannerView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { OfflineSyncBar } from './components/common/OfflineSyncBar';
import { User } from './types';
import { ShieldCheck } from 'lucide-react';

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

export default function App() {
  const [currentView, setCurrentView] = useState<'GATE' | 'ADMIN'>('GATE');
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]);
  const [systemUsers, setSystemUsers] = useState<User[]>(INITIAL_USERS);

  useEffect(() => {
    fetch('/api/users')
      .then((res) => (res.ok ? res.json() : INITIAL_USERS))
      .then((users) => {
        setSystemUsers(users);
        if (users.length > 0 && !currentUser) {
          setCurrentUser(users[0]);
        }
      })
      .catch(() => {
        // Fallback to initial
      });
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        currentUser={currentUser}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4">
        {/* Offline Sync Bar */}
        <OfflineSyncBar />

        {/* View Switch Display */}
        {currentView === 'GATE' ? (
          <div className="space-y-4">
            <GateScannerView />
          </div>
        ) : (
          <AdminDashboard
            currentUser={currentUser}
            onSwitchRole={handleSwitchUser}
            systemUsers={systemUsers}
            onExitAdmin={() => setCurrentView('GATE')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 space-y-1">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="font-semibold text-slate-400">
            Triple C Pigs t/a Colcom Foods
          </span>
          <span>•</span>
          <span>Innscor Africa Group Biosecurity Standard ISO/IEC 27001</span>
        </div>
        <div className="text-[11px] text-slate-600 font-mono">
          PostgreSQL 16 + pgvector (512-D Cosine Metric) • Real-Time SSE Telemetry • African Swine Fever / FMD Containment Engine
        </div>
      </footer>
    </div>
  );
}
