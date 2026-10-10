/**
 * Report & Email Configuration View (Admin Dashboard)
 * Enables managing email alert recipients, denial alert triggers, and EOD PDF summary reports.
 */

import React, { useState, useEffect } from 'react';
import {
  Mail,
  FileText,
  Clock,
  Plus,
  Trash2,
  Check,
  Send,
  Download,
  RefreshCw,
  Bell,
  ShieldAlert,
  Calendar,
} from 'lucide-react';
import { EmailConfig, EmailDispatchLog } from '../../types';

export const ReportEmailConfigView: React.FC = () => {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailDispatchLog[]>([]);
  const [newRecipient, setNewRecipient] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTriggeringEod, setIsTriggeringEod] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [eodSuccessMsg, setEodSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/email-config');
      if (res.ok) {
        setConfig(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/email-logs');
      if (res.ok) {
        setEmailLogs(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !newRecipient.trim() || !newRecipient.includes('@')) return;

    if (!config.recipients.includes(newRecipient.trim())) {
      setConfig({
        ...config,
        recipients: [...config.recipients, newRecipient.trim()],
      });
      setNewRecipient('');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    if (!config) return;
    setConfig({
      ...config,
      recipients: config.recipients.filter((r) => r !== email),
    });
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/email-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerEod = async () => {
    setIsTriggeringEod(true);
    setEodSuccessMsg(null);

    try {
      const res = await fetch('/api/reports/trigger-eod', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setEodSuccessMsg(data.message || 'EOD PDF report dispatched successfully!');
        fetchLogs();
        fetchConfig();
        setTimeout(() => setEodSuccessMsg(null), 5000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTriggeringEod(false);
    }
  };

  const handleDownloadPdf = () => {
    const link = document.createElement('a');
    link.href = '/api/reports/eod-pdf';
    link.download = `colcom_eod_biosecurity_report_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!config) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
        Loading email &amp; report configuration...
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Configuration Header & Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              Automated Email Alerts &amp; EOD PDF Report Configuration
            </h3>
            <p className="text-xs text-slate-400">
              Configure automated denial notification recipients and End-of-Day biosecurity compliance PDF summaries.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              Download PDF Preview
            </button>

            <button
              type="button"
              onClick={handleTriggerEod}
              disabled={isTriggeringEod}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              {isTriggeringEod ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Compiling PDF &amp; Sending...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Generate &amp; Email EOD Report Now
                </>
              )}
            </button>
          </div>
        </div>

        {eodSuccessMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400" />
            {eodSuccessMsg}
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="space-y-6 text-xs">
          {/* Recipient Management Section */}
          <div className="space-y-3">
            <label className="block text-slate-200 font-bold uppercase tracking-wider text-[11px]">
              Designated Stakeholder &amp; Security Officer Email Recipients
            </label>

            {/* Recipients List Chips */}
            <div className="flex flex-wrap gap-2">
              {config.recipients.map((email) => (
                <div
                  key={email}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 flex items-center gap-2 text-white font-mono text-xs"
                >
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRecipient(email)}
                    className="text-slate-400 hover:text-rose-400 transition"
                    title="Remove recipient"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Recipient Form */}
            <div className="flex gap-2 max-w-md pt-1">
              <input
                type="email"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                placeholder="Add stakeholder email (e.g. vet.officer@colcom.co.zw)..."
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono text-xs"
              />
              <button
                type="button"
                onClick={handleAddRecipient}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>

          {/* Toggles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Real-time Denial Alert Toggle */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span className="font-bold text-white text-xs">
                    Real-Time Email Alerts on Entry Denial
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Automatically fires immediate alert emails containing visitor identification, African Swine Fever violation details, and timestamp whenever gate access is denied.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setConfig({ ...config, emailAlertsOnDenial: !config.emailAlertsOnDenial })
                }
                className={`px-3 py-1.5 rounded-lg font-bold transition text-xs shrink-0 ${
                  config.emailAlertsOnDenial
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {config.emailAlertsOnDenial ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* EOD PDF Report Schedule Toggle */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-white text-xs">
                    Daily EOD PDF Summary Report Email
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Compiles daily facility traffic, occupancy levels, and full quarantine audit logs into a formatted PDF document sent to stakeholders.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setConfig({ ...config, eodReportEnabled: !config.eodReportEnabled })
                }
                className={`px-3 py-1.5 rounded-lg font-bold transition text-xs shrink-0 ${
                  config.eodReportEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {config.eodReportEnabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          {/* Schedule Time & SMTP Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                EOD Report Schedule Time (Daily)
              </label>
              <input
                type="time"
                value={config.eodReportScheduleTime}
                onChange={(e) => setConfig({ ...config, eodReportScheduleTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Outbound Sender Email Address
              </label>
              <input
                type="email"
                value={config.senderEmail}
                onChange={(e) => setConfig({ ...config, senderEmail: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Corporate SMTP Gateway Host
              </label>
              <input
                type="text"
                value={config.smtpHost}
                onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            {saveSuccess ? (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> Configuration Saved!
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">
                Emails are sent in compliance with Innscor ISO Biosecurity Reporting standards.
              </span>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center gap-2 shadow"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Configuration
            </button>
          </div>
        </form>
      </div>

      {/* Dispatched Email Logs Audit Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-amber-400" />
            Outbound Email Dispatch Log &amp; Delivery Audit
          </h4>
          <span className="text-[10px] text-slate-400">{emailLogs.length} total dispatches</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Type</th>
                <th className="p-3">Subject / Incident</th>
                <th className="p-3">Recipients</th>
                <th className="p-3">Attachment</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {emailLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-850/50 transition">
                  <td className="p-3 whitespace-nowrap font-mono text-[11px] text-slate-400">
                    {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        log.type === 'REALTIME_DENIAL'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      }`}
                    >
                      {log.type === 'REALTIME_DENIAL' ? 'DENIAL ALERT' : 'EOD PDF REPORT'}
                    </span>
                  </td>
                  <td className="p-3 font-semibold text-white max-w-xs truncate" title={log.subject}>
                    {log.subject}
                  </td>
                  <td className="p-3 font-mono text-[11px] text-slate-400 max-w-xs truncate" title={log.recipients.join(', ')}>
                    {log.recipients.join(', ')}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {log.hasAttachment ? (
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-800">
                        PDF ATTACHED
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">None</span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                      <Check className="w-3.5 h-3.5" />
                      DELIVERED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
