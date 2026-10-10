/**
 * System Settings & MFA Configuration View
 * Enables toggling Email MFA, configuring biometric thresholds, and notification webhooks.
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Mail,
  Phone,
  Cpu,
  Bell,
  Check,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { SystemSettings } from '../../types';

interface SystemSettingsViewProps {
  onSettingsSaved?: () => void;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({ onSettingsSaved }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        if (onSettingsSaved) onSettingsSaved();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
        Loading facility system settings...
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            Security &amp; System Configuration
          </h3>
          <p className="text-xs text-slate-400">
            Control Multi-Factor Authentication enforcement, facial verification thresholds, and alert channels.
          </p>
        </div>

        {saveSuccess && (
          <span className="text-xs text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800 flex items-center gap-1 animate-in fade-in">
            <Check className="w-3.5 h-3.5" /> Settings Saved!
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-5 text-xs">
        {/* Toggleable Email MFA Setting */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white text-sm">
                Enforce Email Multi-Factor Authentication (MFA)
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  settings.emailMfaEnabled
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.emailMfaEnabled ? 'ENABLED' : 'DISABLED (Direct Login)'}
              </span>
            </div>
            <p className="text-slate-400 max-w-lg leading-relaxed">
              When enabled, signing in as <code className="text-emerald-300 font-mono">admin</code> requires a 6-digit OTP verification code sent to the administrator email address. Disabled by default for direct initial login.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSettings({ ...settings, emailMfaEnabled: !settings.emailMfaEnabled })}
            className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 ${
              settings.emailMfaEnabled
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {settings.emailMfaEnabled ? 'Disable Email MFA' : 'Enable Email MFA'}
          </button>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Admin Email */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Admin &amp; MFA Recipient Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={settings.adminEmail}
                onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Biosecurity Hotline */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Chief Veterinary Officer Hotline / SMS Alert Number
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={settings.biosecurityHotline}
                onChange={(e) => setSettings({ ...settings, biosecurityHotline: e.target.value })}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
              />
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Biometric Cosine Similarity Threshold */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-400" />
                Facial Vector Cosine Similarity Threshold
              </label>
              <span className="font-mono font-bold text-emerald-400">
                {(Number(settings.strictBiometricThreshold) * 100).toFixed(1)}% (
                {settings.strictBiometricThreshold})
              </span>
            </div>
            <input
              type="range"
              min="0.70"
              max="0.99"
              step="0.01"
              value={settings.strictBiometricThreshold}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  strictBiometricThreshold: parseFloat(e.target.value),
                })
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Recommended: &gt;0.85 (85%) for ISO-compliant Swine Fever biosafety containment gates.
            </p>
          </div>

          {/* Webhook Endpoint */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Biosecurity SOC Webhook Endpoint
            </label>
            <input
              type="url"
              value={settings.webhookEndpoint}
              onChange={(e) => setSettings({ ...settings, webhookEndpoint: e.target.value })}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono text-[11px]"
            />
          </div>
        </div>

        {/* SMS Toggle */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <div>
              <span className="font-bold text-white block">
                Instant SMS Dispatch on Biosecurity Red Alerts
              </span>
              <span className="text-slate-400 text-[11px]">
                Fires immediate emergency message to Chief Vet Officer upon African Swine Fever breach
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setSettings({ ...settings, quarantineSmsAlerts: !settings.quarantineSmsAlerts })
            }
            className={`px-3 py-1.5 rounded-lg font-bold transition text-xs ${
              settings.quarantineSmsAlerts
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {settings.quarantineSmsAlerts ? 'Active' : 'Disabled'}
          </button>
        </div>

        {/* Save Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950/50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};
