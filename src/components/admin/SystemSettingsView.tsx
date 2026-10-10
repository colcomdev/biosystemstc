/**
 * System Settings, Corporate Logo Management & Theme Settings View
 * INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS
 * 
 * Features:
 * - Dynamic Logo Branding: Upload, preview, update, or remove company logo
 * - Full Light/Dark Mode preferences & toggle
 * - Toggleable Email MFA enforcement (Disabled by default for seamless direct login)
 * - Facial similarity threshold slider
 * - Biosecurity hotline & emergency alert channels
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Shield,
  Mail,
  Phone,
  Cpu,
  Bell,
  Check,
  RefreshCw,
  Image as ImageIcon,
  Upload,
  Trash2,
  Sun,
  Moon,
  Building2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { SystemSettings } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface SystemSettingsViewProps {
  onSettingsSaved?: () => void;
  onLogoUpdated?: (newLogoUrl: string | null) => void;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({
  onSettingsSaved,
  onLogoUpdated,
}) => {
  const { theme, setTheme, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Logo upload state
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoMessage, setLogoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data: SystemSettings = await res.json();
        setSettings(data);
        setLogoPreviewUrl(data.logoUrl || null);
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoMessage({ type: 'error', text: 'Please select a valid image file (PNG, JPG, SVG, WebP).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLogoMessage({ type: 'error', text: 'Logo image must be smaller than 5MB.' });
      return;
    }

    setSelectedLogoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setLogoPreviewUrl(objectUrl);
    setLogoMessage(null);
  };

  const handleUploadLogo = async () => {
    if (!selectedLogoFile) return;

    setIsUploadingLogo(true);
    setLogoMessage(null);

    const formData = new FormData();
    formData.append('logo', selectedLogoFile);

    try {
      const res = await fetch('/api/settings/logo', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.logoUrl) {
        setLogoMessage({ type: 'success', text: 'Company logo successfully updated and broadcast to all gate posts!' });
        if (settings) {
          setSettings({ ...settings, logoUrl: data.logoUrl });
        }
        setLogoPreviewUrl(data.logoUrl);
        setSelectedLogoFile(null);
        if (onLogoUpdated) onLogoUpdated(data.logoUrl);
        if (onSettingsSaved) onSettingsSaved();
      } else {
        setLogoMessage({ type: 'error', text: data.error || 'Failed to upload logo' });
      }
    } catch {
      setLogoMessage({ type: 'error', text: 'Network error uploading logo.' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    setIsUploadingLogo(true);
    setLogoMessage(null);

    try {
      const res = await fetch('/api/settings/logo', {
        method: 'DELETE',
      });

      if (res.ok) {
        setLogoMessage({ type: 'success', text: 'Custom logo removed. Reverted to official Triple C Pigs badge.' });
        if (settings) {
          setSettings({ ...settings, logoUrl: null });
        }
        setLogoPreviewUrl(null);
        setSelectedLogoFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (onLogoUpdated) onLogoUpdated(null);
        if (onSettingsSaved) onSettingsSaved();
      }
    } catch {
      setLogoMessage({ type: 'error', text: 'Failed to remove custom logo.' });
    } finally {
      setIsUploadingLogo(false);
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
        body: JSON.stringify({
          ...settings,
          defaultTheme: theme,
        }),
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
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
        Loading facility system settings...
      </div>
    );
  }

  return (
    <div className="bg-slate-900 dark:bg-slate-900 dark:border-slate-800 border border-slate-700/60 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            Security, Branding &amp; System Configuration
          </h3>
          <p className="text-xs text-slate-400">
            Control Multi-Factor Authentication enforcement, custom logo branding, theme presets, and biosecurity alert thresholds.
          </p>
        </div>

        {saveSuccess && (
          <span className="text-xs text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800 flex items-center gap-1 animate-in fade-in self-start sm:self-auto">
            <Check className="w-3.5 h-3.5" /> Settings Saved!
          </span>
        )}
      </div>

      {/* 1. Dynamic Corporate Logo Branding Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="font-bold text-white text-sm block">
                Dynamic Corporate Logo Branding
              </span>
              <span className="text-xs text-slate-400">
                Uploaded logo automatically renders on the Mobile Gate Scanner, Admin Dashboard header, and at the top of generated PDF summary reports.
              </span>
            </div>
          </div>

          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 self-start sm:self-auto">
            LIVE BRANDING SYNC
          </span>
        </div>

        {logoMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              logoMessage.type === 'success'
                ? 'bg-emerald-950/70 border border-emerald-700 text-emerald-200'
                : 'bg-rose-950/70 border border-rose-700 text-rose-200'
            }`}
          >
            {logoMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{logoMessage.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          {/* Logo Preview Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[140px] text-center space-y-2 relative">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 absolute top-2 left-3">
              Current Logo Preview
            </span>

            {logoPreviewUrl ? (
              <div className="pt-4 flex flex-col items-center">
                <img
                  src={logoPreviewUrl}
                  alt="Company Logo Preview"
                  className="max-h-20 max-w-full object-contain rounded-lg p-1 bg-white/5 border border-slate-700"
                />
                <span className="text-[11px] text-emerald-400 font-semibold mt-2 flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5" /> Custom Logo Active
                </span>
              </div>
            ) : (
              <div className="pt-4 flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 font-black text-xl tracking-wider">
                  3C
                </div>
                <div className="mt-2 text-xs font-bold text-slate-300">
                  Default: INNSCOR AFRICA • TRIPLE C PIGS
                </div>
                <span className="text-[10px] text-slate-500">
                  No custom logo uploaded. System using default vector badge.
                </span>
              </div>
            )}
          </div>

          {/* Upload & Actions Controls */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Select Logo Image (PNG, JPG, SVG, WebP - max 5MB)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 file:cursor-pointer cursor-pointer bg-slate-900 border border-slate-700 rounded-xl p-1"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={!selectedLogoFile || isUploadingLogo}
                onClick={handleUploadLogo}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
              >
                {isUploadingLogo ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>Upload &amp; Apply Logo</span>
              </button>

              {logoPreviewUrl && (
                <button
                  type="button"
                  disabled={isUploadingLogo}
                  onClick={handleRemoveLogo}
                  className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove / Reset to Default</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Recommended: Transparent PNG or SVG with aspect ratio around 3:1 or square. Will be scaled for headers (height 36px) and printed at the top right of A4 PDF reports (width 26mm).
            </p>
          </div>
        </div>
      </div>

      {/* 2. Theme Management Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-indigo-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
            <span className="font-bold text-white text-sm">
              Theme Management &amp; UI Appearance
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              CURRENT: {theme.toUpperCase()}
            </span>
          </div>
          <p className="text-slate-400 text-xs max-w-lg leading-relaxed">
            Full support for both Light Mode and Dark Mode across the entire application (Mobile Gate Scanner &amp; Admin Dashboard) with local preference persistence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTheme('light');
              if (settings) setSettings({ ...settings, defaultTheme: 'light' });
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
              theme === 'light'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-45 transition" />
            Light Mode
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('dark');
              if (settings) setSettings({ ...settings, defaultTheme: 'dark' });
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
              theme === 'dark'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-indigo-300" />
            Dark Mode
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5 text-xs">
        {/* 3. Toggleable Email MFA Setting */}
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
              When enabled, signing in as <code className="text-emerald-300 font-mono font-bold">admin</code> requires a 6-digit OTP verification code sent to the administrator email address. Disabled by default for direct initial login.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSettings({ ...settings, emailMfaEnabled: !settings.emailMfaEnabled })}
            className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 shrink-0 ${
              settings.emailMfaEnabled
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {settings.emailMfaEnabled ? 'Disable Email MFA' : 'Enable Email MFA'}
          </button>
        </div>

        {/* 4. Configuration Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Facility Official Name */}
          <div className="sm:col-span-2">
            <label className="block text-slate-300 font-semibold mb-1">
              Official Organization Title
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={settings.facilityName}
                onChange={(e) => setSettings({ ...settings, facilityName: e.target.value })}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-semibold"
              />
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

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
              Triple C Biosecurity Emergency Hotline
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
              Triple C SOC Webhook Endpoint
            </label>
            <input
              type="url"
              value={settings.webhookEndpoint || ''}
              onChange={(e) => setSettings({ ...settings, webhookEndpoint: e.target.value })}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono text-[11px]"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950/50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save All Settings
          </button>
        </div>
      </form>
    </div>
  );
};
