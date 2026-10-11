/**
 * Global Header & Organization Navigation Bar
 * INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS
 * 
 * Features:
 * - Dynamic corporate logo rendering
 * - Light Mode / Dark Mode instant toggle
 * - Surface switching between Handheld Gate Mobile Surface and Admin Portal
 */

import React from 'react';
import { Shield, Lock, Smartphone, LayoutDashboard, Sun, Moon, ShieldCheck } from 'lucide-react';
import { User } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { resolveAssetUrl } from '../../lib/api';

interface NavbarProps {
  currentView: 'GATE' | 'ADMIN';
  onViewChange: (view: 'GATE' | 'ADMIN') => void;
  currentUser: User;
  logoUrl?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  currentUser,
  logoUrl,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 backdrop-blur-md bg-slate-900/95 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Organization Title with Dynamic Logo */}
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={resolveAssetUrl(logoUrl) || ''}
              alt="INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS"
              className="h-9 max-w-[130px] object-contain rounded-lg p-0.5 bg-white/10 border border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 font-black text-sm tracking-wider shrink-0">
              3C
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-white tracking-tight">
                INNSCOR AFRICA LTD(Colcom Foods) <span className="text-emerald-400 font-semibold">T/A TRIPLE C PIGS</span>
              </span>
              <span className="hidden md:inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                BIO-GATE PASS
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls: Theme Toggle & Surface Switcher */}
        <div className="flex items-center gap-2">
          {/* Light/Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center justify-center"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-300" />
            )}
          </button>

          {/* Surface Switcher */}
          {currentView === 'GATE' ? (
            <button
              type="button"
              onClick={() => onViewChange('ADMIN')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
              title="Restricted Security Operations Portal (Login required)"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xs:inline">Admin Portal</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                ADMIN SOC ACTIVE
              </span>
              <button
                type="button"
                onClick={() => onViewChange('GATE')}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Gate Surface</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
