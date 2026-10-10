/**
 * Global Header & Organization Navigation Bar
 * Triple C Pigs t/a Colcom Foods (Innscor Africa Group)
 * Enforces Surface Isolation: Gate Mobile Surface does not expose admin dashboards or logs.
 */

import React from 'react';
import { Shield, Lock, Smartphone, LayoutDashboard } from 'lucide-react';
import { User } from '../../types';

interface NavbarProps {
  currentView: 'GATE' | 'ADMIN';
  onViewChange: (view: 'GATE' | 'ADMIN') => void;
  currentUser: User;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-slate-900/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Organization Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 font-black text-base tracking-wider shrink-0">
            3C
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-white tracking-tight">
                Triple C Pigs <span className="text-slate-400 font-normal">t/a</span> Colcom Foods
              </span>
              <span className="hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                INNSCOR AFRICA
              </span>
            </div>
            <p className="text-[10px] text-emerald-400 font-medium">
              African Swine Fever / FMD Bio-Interlock &amp; pgvector Biometrics
            </p>
          </div>
        </div>

        {/* Surface Switcher */}
        <div className="flex items-center gap-2">
          {currentView === 'GATE' ? (
            /* Discrete Admin Surface Access Button */
            <button
              type="button"
              onClick={() => onViewChange('ADMIN')}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
              title="Restricted Security Operations Portal (Login required)"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin Portal</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                ADMIN SOC ACTIVE
              </span>
              <button
                type="button"
                onClick={() => onViewChange('GATE')}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Handheld Gate Surface
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
