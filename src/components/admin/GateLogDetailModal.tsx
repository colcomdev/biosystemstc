/**
 * Visitor Gate Log Detail Modal
 * INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS
 * Displays complete profile & biosecurity audit trail when a user clicks on an audit gate log record.
 */

import React, { useState } from 'react';
import {
  X,
  User,
  CreditCard,
  Phone,
  Globe2,
  Truck,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  LogOut,
  Camera,
  AlertTriangle,
  QrCode,
} from 'lucide-react';
import { GateLogRecord } from '../../types';
import { apiUrl } from '../../lib/api';

interface GateLogDetailModalProps {
  log: GateLogRecord | null;
  onClose: () => void;
  onCheckOutSuccess?: (updatedLog: GateLogRecord) => void;
}

export const GateLogDetailModal: React.FC<GateLogDetailModalProps> = ({
  log,
  onClose,
  onCheckOutSuccess,
}) => {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  if (!log) return null;

  const isInside = log.isInside ?? (log.status === 'GRANTED' && !log.checkOutTime);

  const handlePerformCheckOut = async () => {
    setIsCheckingOut(true);
    setCheckoutMessage(null);
    setCheckoutError(null);

    try {
      const res = await fetch(apiUrl('/api/gate/check-out'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idNumber: log.idNumber,
          visitId: log.id,
          operatorName: 'Admin SOC Supervisor',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCheckoutMessage(data.message || `Visitor ${log.visitorName} successfully checked out.`);
        if (onCheckOutSuccess) {
          onCheckOutSuccess(data.visit);
        }
      } else {
        setCheckoutError(data.error || 'Failed to check out visitor.');
      }
    } catch (err) {
      setCheckoutError('Network error while processing check-out request.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-950/50">
          <div className="flex items-center gap-3">
            {log.photoUrl ? (
              <img
                src={log.photoUrl}
                alt={log.visitorName}
                className="w-12 h-12 rounded-xl object-cover border-2 border-slate-700 shadow"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700 shadow">
                <User className="w-6 h-6" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-wide">
                  {log.visitorName}
                </h2>
                {log.status === 'GRANTED' ? (
                  isInside ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      INSIDE FACILITY
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      CHECKED OUT
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700">
                    <XCircle className="w-3 h-3" />
                    ACCESS DENIED
                  </span>
                )}
                {log.syncedFromOffline && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                    OFFLINE SYNC
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Log ID: {log.id} • Registered Gate: {log.gateId}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Checkout Notification Messages */}
          {checkoutMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{checkoutMessage}</span>
            </div>
          )}

          {checkoutError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{checkoutError}</span>
            </div>
          )}

          {/* Grid of Key Attributes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">ID / Passport</span>
              <div className="font-mono text-white text-xs font-semibold mt-0.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                {log.idNumber}
              </div>
              <span className="text-[10px] text-slate-400 font-sans">{log.idType}</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Contact Phone</span>
              <div className="font-mono text-white text-xs font-semibold mt-0.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                +{log.phoneNumber}
              </div>
              <span className="text-[10px] text-slate-400 font-sans">Verified Mobile</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Country of Origin</span>
              <div className="text-cyan-300 text-xs font-semibold mt-0.5 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
                {log.countryOfOrigin}
              </div>
              <span className="text-[10px] text-slate-400 font-sans">Regional Compliance</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Vehicle Reg</span>
              <div className="font-mono text-white text-xs font-semibold mt-0.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                {log.vehicleReg || 'None / Pedestrian'}
              </div>
              <span className="text-[10px] text-slate-400 font-sans">Vehicle Screening</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Biometric Score</span>
              <div className="font-mono text-xs font-bold mt-0.5 flex items-center gap-1.5">
                <span className={log.similarityScore >= 0.85 ? 'text-emerald-400' : 'text-rose-400'}>
                  {(log.similarityScore * 100).toFixed(1)}% Match
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-sans">
                {log.similarityScore >= 0.85 ? 'Identity Verified' : 'Standard Baseline'}
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Gate Badge</span>
              <div className="font-mono text-xs font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                {log.badgeNumber || 'None (Denied)'}
              </div>
              <span className="text-[10px] text-slate-400 font-sans">Access Pass ID</span>
            </div>
          </div>

          {/* Timing & Movements */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Entry &amp; Departure Timestamps
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <div>
                <span className="text-slate-500 block text-[10px]">Check-In Time:</span>
                <span className="font-mono font-medium">{new Date(log.timestamp).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Check-Out Time:</span>
                {log.checkOutTime ? (
                  <span className="font-mono font-medium text-emerald-400">
                    {new Date(log.checkOutTime).toLocaleString()}
                  </span>
                ) : isInside ? (
                  <span className="font-mono font-medium text-amber-400">Still Inside Facility</span>
                ) : (
                  <span className="text-slate-500">N/A (Entry Denied)</span>
                )}
              </div>
            </div>
          </div>

          {/* Place of Origin & Purpose of Visit */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              Visit Context &amp; Purpose
            </span>
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-500 text-[10px] block">Origin (Place / Company):</span>
                <span className="text-white font-medium">{log.origin}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Official Purpose:</span>
                <span className="text-slate-200">{log.purpose}</span>
              </div>
            </div>
          </div>

          {/* Comments if ANY */}
          {log.comments && (
            <div className="p-3.5 bg-slate-950 rounded-xl border border-emerald-900/40 space-y-1.5">
              <span className="text-[11px] uppercase font-bold text-emerald-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Visitor / Gate Comments &amp; Remarks
              </span>
              <p className="text-slate-200 text-xs italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                "{log.comments}"
              </p>
            </div>
          )}

          {/* Biosecurity Quarantine Reasons if Denied */}
          {log.quarantineReasons && log.quarantineReasons.length > 0 && (
            <div className="p-3.5 bg-rose-950/40 rounded-xl border border-rose-800/80 space-y-2">
              <span className="text-[11px] uppercase font-bold text-rose-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Biosecurity Quarantine Rule Violations ({log.quarantineReasons.length})
              </span>
              <ul className="space-y-1 pl-1">
                {log.quarantineReasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-rose-200 text-xs">
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500">
            Recorded by: <span className="text-slate-300 font-semibold">{log.operatorName}</span>
          </div>

          <div className="flex items-center gap-2">
            {isInside && !log.checkOutTime && log.status === 'GRANTED' && (
              <button
                type="button"
                onClick={handlePerformCheckOut}
                disabled={isCheckingOut}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow"
              >
                <LogOut className="w-3.5 h-3.5" />
                {isCheckingOut ? 'Checking Out...' : 'Check Out Visitor Now'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
