/**
 * Executive & Biosecurity Admin Portal (Protected SOC View)
 * Features:
 * - Default Auth: username 'admin', password 'admin'
 * - Toggleable Email MFA support (disabled by default, configurable in Settings)
 * - Dynamic Form Engine & Question Builder
 * - Real-time SSE live telemetry & incident feed
 * - Denied entry audit logs & CSV export
 * - PostgreSQL pgvector schema viewer
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Activity,
  Lock,
  Radio,
  FileSpreadsheet,
  Database,
  UserPlus,
  CheckCircle2,
  XCircle,
  Clock,
  KeyRound,
  RefreshCw,
  Search,
  Filter,
  Check,
  Eye,
  Layers,
  Settings,
  LogOut,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import {
  BiosecurityAlert,
  DynamicFormQuestion,
  GateLogRecord,
  RegisteredVisitor,
  SystemSettings,
  TelemetryStats,
  User,
} from '../../types';
import { DEFAULT_DECLARATION_QUESTIONS } from '../../data/defaultQuestions';
import { PostgresArchitectureModal } from './PostgresArchitectureModal';
import { PreRegisterModal } from './PreRegisterModal';
import { DynamicQuestionBuilder } from './DynamicQuestionBuilder';
import { SystemSettingsView } from './SystemSettingsView';
import { ReportEmailConfigView } from './ReportEmailConfigView';
import { GateLogDetailModal } from './GateLogDetailModal';
import { ITAdminManagementView } from './ITAdminManagementView';
import { apiUrl, resolveAssetUrl } from '../../lib/api';

interface AdminDashboardProps {
  currentUser: User;
  onSwitchRole: (user: User) => void;
  systemUsers: User[];
  onExitAdmin: () => void;
  logoUrl?: string | null;
  onLogoChange?: (url: string | null) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onExitAdmin,
  logoUrl,
  onLogoChange,
}) => {
  // Authentication & MFA State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('tcp_admin_authenticated') === 'true';
  });
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // MFA Flow
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaOtpInput, setMfaOtpInput] = useState('');
  const [mfaEmail, setMfaEmail] = useState('admin@triplecpigs.co.zw');
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  // Active Tab with LocalStorage persistence
  const [activeTab, setActiveTab] = useState<
    'alerts' | 'builder' | 'logs' | 'whitelist' | 'email_reports' | 'settings' | 'it_admin'
  >(() => {
    return (localStorage.getItem('tcp_admin_active_tab') as any) || 'alerts';
  });

  const handleSelectTab = (
    tab: 'alerts' | 'builder' | 'logs' | 'whitelist' | 'email_reports' | 'settings' | 'it_admin'
  ) => {
    setActiveTab(tab);
    localStorage.setItem('tcp_admin_active_tab', tab);
  };

  // Selected Log for User Details Pop-up Modal
  const [selectedLog, setSelectedLog] = useState<GateLogRecord | null>(null);

  // Live Data State (Dynamic from DB)
  const [telemetry, setTelemetry] = useState<TelemetryStats>({
    todayTotalAttempts: 0,
    todayGranted: 0,
    todayDenied: 0,
    activeOnSiteOccupancy: 0,
    quarantineAlertsCount: 0,
    averageDecisionTimeMs: 128,
  });
  const [alerts, setAlerts] = useState<BiosecurityAlert[]>([]);
  const [logs, setLogs] = useState<GateLogRecord[]>([]);
  const [visitors, setVisitors] = useState<RegisteredVisitor[]>([]);
  const [questions, setQuestions] = useState<DynamicFormQuestion[]>(DEFAULT_DECLARATION_QUESTIONS);
  const [sseConnected, setSseConnected] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState<'ALL' | 'GRANTED' | 'DENIED'>('ALL');

  // Modals
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isPreRegisterModalOpen, setIsPreRegisterModalOpen] = useState(false);

  useEffect(() => {
    fetchTelemetry();
    fetchAlerts();
    fetchLogs();
    fetchVisitors();
    fetchQuestions();

    const eventSource = new EventSource(apiUrl('/api/events'));

    eventSource.onopen = () => setSseConnected(true);
    eventSource.addEventListener('init', () => setSseConnected(true));

    eventSource.addEventListener('biosecurity_alert', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.alert) {
          setAlerts((prev) => [payload.alert, ...prev]);
          setTelemetry((prev) => ({
            ...prev,
            todayDenied: prev.todayDenied + 1,
            todayTotalAttempts: prev.todayTotalAttempts + 1,
            quarantineAlertsCount:
              payload.alert.priority === 'CRITICAL'
                ? prev.quarantineAlertsCount + 1
                : prev.quarantineAlertsCount,
          }));
        }
      } catch (err) {
        console.error(err);
      }
    });

    eventSource.addEventListener('telemetry_update', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.activeOccupants !== undefined) {
          setTelemetry((prev) => ({
            ...prev,
            activeOnSiteOccupancy: payload.activeOccupants,
          }));
        }
        fetchTelemetry();
        fetchLogs();
      } catch (err) {
        console.error(err);
      }
    });

    eventSource.addEventListener('form_questions_updated', () => {
      fetchQuestions();
    });

    eventSource.onerror = () => setSseConnected(false);

    return () => {
      eventSource.close();
    };
  }, []);

  const fetchTelemetry = async () => {
    try {
      const res = await fetch(apiUrl('/api/stats'));
      if (res.ok) setTelemetry(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch(apiUrl('/api/alerts'));
      if (res.ok) setAlerts(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(apiUrl('/api/logs'));
      if (res.ok) setLogs(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVisitors = async () => {
    try {
      const res = await fetch(apiUrl('/api/visitors'));
      if (res.ok) setVisitors(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await fetch(apiUrl('/api/form-questions'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setQuestions(data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        // Response is not JSON
      }

      if (!data) {
        if (rawText.includes('<!DOCTYPE html') || rawText.includes('<html') || !rawText.trim()) {
          setAuthError(
            'Backend server unreachable: Render is currently running as a "Static Site" (HTML only) instead of a "Web Service" (Node.js). In Render, deploy as a Web Service with Build: "npm install --legacy-peer-deps && npm run build" and Start: "npm start".'
          );
          return;
        }
        setAuthError('Connection error: Received invalid response from server.');
        return;
      }

      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }

      if (data.mfaRequired) {
        setMfaRequired(true);
        setMfaEmail(data.email);
        setDebugOtp(data.debugOtp);
      } else {
        setIsAuthenticated(true);
        localStorage.setItem('tcp_admin_authenticated', 'true');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Connection error during authentication. Check your network or backend URL.');
    }
  };

  // MFA OTP Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    try {
      const res = await fetch(apiUrl('/api/auth/verify-mfa'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: mfaOtpInput }),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        // Not JSON
      }

      if (!data) {
        setAuthError('Connection error: Invalid response from backend.');
        return;
      }

      if (!res.ok) {
        setAuthError(data.error || 'Invalid OTP code.');
        return;
      }

      setIsAuthenticated(true);
      localStorage.setItem('tcp_admin_authenticated', 'true');
      setMfaRequired(false);
    } catch {
      setAuthError('Verification failed.');
    }
  };

  const handleAcknowledgeAlert = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/alerts/${id}/acknowledge`), { method: 'PATCH' });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: 'INVESTIGATING' } : a))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveAlert = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/alerts/${id}/resolve`), { method: 'PATCH' });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: 'RESOLVED' } : a))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Visitor Name', 'ID Type', 'ID Number', 'Country of Origin', 'Phone', 'Vehicle', 'Origin', 'Status', 'Similarity', 'Gate', 'Reasons'];
    const rows = logs.map((l) => [
      l.timestamp,
      `"${l.visitorName}"`,
      l.idType,
      `"${l.idNumber}"`,
      `"${l.countryOfOrigin}"`,
      `"${l.phoneNumber}"`,
      l.vehicleReg || 'N/A',
      `"${l.origin}"`,
      l.status,
      (l.similarityScore * 100).toFixed(1) + '%',
      l.gateId,
      `"${(l.quarantineReasons || []).join('; ')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `colcom_biosecurity_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter((l) => {
    if (logFilter !== 'ALL' && l.status !== logFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        l.visitorName.toLowerCase().includes(q) ||
        l.phoneNumber.includes(q) ||
        l.idNumber.toLowerCase().includes(q) ||
        l.countryOfOrigin.toLowerCase().includes(q) ||
        (l.vehicleReg && l.vehicleReg.toLowerCase().includes(q)) ||
        l.origin.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Login Gate Screen
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md mx-auto my-12 bg-slate-900 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in">
        <div className="text-center space-y-2">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Corporate Logo"
              className="h-14 max-w-[160px] object-contain rounded-xl p-1 bg-white/10 border border-slate-700 mx-auto shadow-lg"
            />
          ) : (
            <div className="w-14 h-14 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-950/50">
              <Lock className="w-7 h-7" />
            </div>
          )}
          <h2 className="text-xl font-black text-white tracking-tight">
            Security &amp; Biosecurity Portal
          </h2>
          <p className="text-xs text-slate-400">
            TRIPLE C PIGS (INNSCOR AFRICA LTD) • Administrative Surface
          </p>
        </div>

        {authError && (
          <div className="text-xs text-rose-300 bg-rose-950/70 p-3 rounded-xl border border-rose-800">
            {authError}
          </div>
        )}

        {!mfaRequired ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter username"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-emerald-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-emerald-500 outline-none font-mono"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-950/50"
              >
                Sign In to Admin Portal
              </button>
              <button
                type="button"
                onClick={onExitAdmin}
                className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition"
              >
                Back to Gate
              </button>
            </div>
          </form>
        ) : (
          /* MFA OTP Form */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <Mail className="w-3.5 h-3.5" /> Email MFA Enforced
              </div>
              <p className="text-[11px] text-slate-400">
                A 6-digit verification code has been dispatched to{' '}
                <strong className="text-white font-mono">{mfaEmail}</strong>
              </p>
              {debugOtp && (
                <div className="text-[10px] text-amber-300 bg-amber-950/60 p-1.5 rounded font-mono">
                  Demo OTP Code: {debugOtp}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                Enter 6-Digit Email OTP
              </label>
              <input
                type="text"
                autoFocus
                maxLength={6}
                value={mfaOtpInput}
                onChange={(e) => setMfaOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="0 0 0 0 0 0"
                className="w-full text-center text-2xl font-mono tracking-widest py-3 px-4 bg-slate-950 border border-slate-700 rounded-xl text-white focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition"
              >
                Verify &amp; Enter
              </button>
              {debugOtp && (
                <button
                  type="button"
                  onClick={() => setMfaOtpInput(debugOtp)}
                  className="px-3 py-3 bg-slate-800 text-slate-300 text-xs rounded-xl"
                  title="Autofill OTP"
                >
                  Autofill
                </button>
              )}
            </div>
          </form>
        )}

        <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Restricted Portal • IT Admin &amp; Security Roles Only</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 animate-in fade-in">
      {/* Top Telemetry KPI Cards Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
              Active Facility Occupancy
            </span>
            <div className="text-2xl font-black text-white font-mono flex items-center gap-2">
              {telemetry.activeOnSiteOccupancy}
              <span className="text-xs font-normal text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                LIVE
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-600/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
              Passed Biosecurity (Today)
            </span>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {telemetry.todayGranted}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-600/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
              Denied Entries (Today)
            </span>
            <div className="text-2xl font-black text-rose-400 font-mono">
              {telemetry.todayDenied}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-600/30 flex items-center justify-center text-rose-400 shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
              Swine Biosecurity Quarantine Flags
            </span>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {telemetry.quarantineAlertsCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-600/30 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
              Decision Engine Latency
            </span>
            <div className="text-2xl font-black text-cyan-400 font-mono">
              {telemetry.averageDecisionTimeMs}ms
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-600/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectTab('alerts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'alerts'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Live Quarantine Feeds
            {alerts.filter((a) => a.status === 'PENDING_ACK').length > 0 && (
              <span className="bg-white text-rose-700 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {alerts.filter((a) => a.status === 'PENDING_ACK').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('builder')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'builder'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Dynamic Form Builder ({questions.length})
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('logs')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Audit Gate Logs ({logs.length})
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('whitelist')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'whitelist'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Authorized Registry ({visitors.length})
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('email_reports')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'email_reports'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Mail className="w-4 h-4" />
            Email &amp; PDF Reports
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('it_admin')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'it_admin'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            IT Admin &amp; Users
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('settings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            System Settings
          </button>
        </div>

        {/* Global Architecture, Export, & Sign Out */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSchemaModalOpen(true)}
            className="px-3 py-2 bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-700/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Database className="w-3.5 h-3.5" />
            PostgreSQL &amp; pgvector
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => {
              setIsAuthenticated(false);
              localStorage.removeItem('tcp_admin_authenticated');
            }}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
            title="Lock Portal / Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TAB 1: Live Alerts Feed (SSE Stream) */}
      {activeTab === 'alerts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                Real-Time Gate Incident &amp; Denial Feed (SSE Telemetry)
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  sseConnected
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}
              >
                {sseConnected ? 'STREAM CONNECTED' : 'RECONNECTING'}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchAlerts}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          <div className="space-y-2.5">
            {alerts.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
                No active biosecurity alerts. All gate entries operating within safe parameters.
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 transition shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    alert.status === 'PENDING_ACK'
                      ? 'border-rose-500/80 bg-rose-950/20'
                      : alert.status === 'INVESTIGATING'
                      ? 'border-amber-500/60 bg-amber-950/10'
                      : 'border-slate-800 opacity-70'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          alert.priority === 'CRITICAL'
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-amber-600 text-white'
                        }`}
                      >
                        {alert.priority} BIOSECURITY BREACH
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(alert.timestamp).toLocaleTimeString()} • Gate: {alert.gateId}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          alert.status === 'PENDING_ACK'
                            ? 'bg-rose-950 text-rose-300 border-rose-700'
                            : alert.status === 'INVESTIGATING'
                            ? 'bg-amber-950 text-amber-300 border-amber-700'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        }`}
                      >
                        {alert.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{alert.visitorName}</span>
                      <span className="text-xs text-slate-400 font-mono font-normal">
                        (+{alert.phone})
                      </span>
                      {alert.vehicleReg && (
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                          {alert.vehicleReg}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-rose-300/90 space-y-0.5">
                      {alert.reasons.map((r, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-1">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check className="w-3 h-3" /> Real-Time Email Fired to Triple C SOC
                      </span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check className="w-3 h-3" /> Webhook Fired to Triple C SOC
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {alert.status === 'PENDING_ACK' && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Acknowledge &amp; Investigate
                      </button>
                    )}

                    {alert.status === 'INVESTIGATING' && (
                      <button
                        type="button"
                        onClick={() => handleResolveAlert(alert.id)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Cleared / Resolved
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Dynamic Form Engine & Question Builder */}
      {activeTab === 'builder' && (
        <DynamicQuestionBuilder questions={questions} onRefresh={fetchQuestions} />
      )}

      {/* TAB 3: Comprehensive Gate Audit Logs */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search visitor, phone, ID, country, vehicle reg..."
                className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs outline-none focus:border-emerald-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filter:
              </span>
              <button
                type="button"
                onClick={() => setLogFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  logFilter === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('GRANTED')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  logFilter === 'GRANTED' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Granted Only
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('DENIED')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  logFilter === 'DENIED' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Denied Only
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Visitor Name</th>
                  <th className="p-3">Credentials (ID / Passport)</th>
                  <th className="p-3">Country</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Origin / Purpose</th>
                  <th className="p-3">Biometrics</th>
                  <th className="p-3">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredLogs.map((log) => {
                  const isInside = log.isInside ?? (log.status === 'GRANTED' && !log.checkOutTime);
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-800/70 transition cursor-pointer group"
                      title="Click to view detailed visitor profile, credentials & biosecurity audit log"
                    >
                      <td className="p-3 whitespace-nowrap font-mono text-[11px] text-slate-400 group-hover:text-slate-200">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 font-semibold text-white whitespace-nowrap group-hover:text-emerald-300 transition">
                        {log.visitorName}
                        {log.syncedFromOffline && (
                          <span className="ml-1 text-[9px] bg-amber-950 text-amber-300 px-1 py-0.2 rounded border border-amber-800">
                            OFFLINE SYNC
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        <span className="text-[10px] text-slate-400 block">{log.idType}</span>
                        {log.idNumber}
                      </td>
                      <td className="p-3 text-cyan-300 whitespace-nowrap">
                        {log.countryOfOrigin}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        +{log.phoneNumber}
                      </td>
                      <td className="p-3 max-w-xs truncate" title={`${log.origin} - ${log.purpose}`}>
                        <span className="text-slate-200">{log.origin}</span>
                        <span className="text-slate-400 block text-[11px] truncate">{log.purpose}</span>
                      </td>
                      <td className="p-3 whitespace-nowrap font-mono text-[11px]">
                        <span
                          className={
                            log.similarityScore >= 0.85 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'
                          }
                        >
                          {(log.similarityScore * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {log.status === 'GRANTED' ? (
                          isInside ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              INSIDE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-300 font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">
                              CHECKED OUT
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold px-2 py-0.5 rounded bg-rose-950/70 border border-rose-800 text-[11px]">
                            <XCircle className="w-3 h-3" />
                            DENIED
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Whitelist Register */}
      {activeTab === 'whitelist' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Authorized Whitelist &amp; Facial Embeddings Register
              </h3>
              <p className="text-xs text-slate-400">
                Pre-approved contractors, feed suppliers, vet inspectors, and group auditors.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPreRegisterModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              <UserPlus className="w-4 h-4" />
              Enroll Authorized Visitor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {visitors.map((v) => (
              <div
                key={v.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-start gap-3 relative overflow-hidden"
              >
                <img
                  src={v.photoUrl}
                  alt={v.fullName}
                  className="w-14 h-14 rounded-xl object-cover border border-emerald-500/50 shadow shrink-0"
                />
                <div className="space-y-0.5 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{v.fullName}</div>
                  <div className="text-xs text-emerald-400 font-medium truncate">{v.company}</div>
                  <div className="text-[11px] text-slate-300 font-mono">
                    {v.idType}: {v.idNumber}
                  </div>
                  <div className="text-[11px] text-cyan-300 font-medium">
                    {v.countryOfOrigin}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">+{v.phoneNumber}</div>
                  <div className="pt-1 flex items-center gap-1">
                    <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                      {v.category}
                    </span>
                    <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded font-mono border border-emerald-800">
                      512D VECTOR READY
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Email Alerts & EOD PDF Reports */}
      {activeTab === 'email_reports' && <ReportEmailConfigView />}

      {/* TAB 6: IT Admin Rights & User Management */}
      {activeTab === 'it_admin' && <ITAdminManagementView currentUser={currentUser} />}

      {/* TAB 7: System Settings & Toggleable MFA */}
      {activeTab === 'settings' && <SystemSettingsView onLogoUpdated={onLogoChange} />}

      {/* Modals */}
      <PostgresArchitectureModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
      />

      <PreRegisterModal
        isOpen={isPreRegisterModalOpen}
        onClose={() => setIsPreRegisterModalOpen(false)}
        onVisitorAdded={(newVis) => setVisitors((prev) => [newVis, ...prev])}
      />

      {/* Gate Log Visitor Details Pop-up Modal */}
      <GateLogDetailModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onCheckOutSuccess={(updated) => {
          setSelectedLog(updated);
          setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
          fetchTelemetry();
        }}
      />
    </div>
  );
};
