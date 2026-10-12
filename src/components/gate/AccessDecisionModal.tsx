/**
 * Dynamic Access Decision Pop-Up Modal
 * Full-screen Green/Red Overlay for Handheld Mobile Gate Scanners
 * Enforces Triple C Pigs Biosecurity Quarantine Decisions
 */

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  Printer,
  QrCode,
  Share2,
  Clock,
  UserCheck,
  Building,
  RotateCcw,
  Radio,
  FileWarning,
  Check,
  Globe2,
  CreditCard,
} from 'lucide-react';
import { AccessDecisionResponse } from '../../types';
import { playAccessGrantedSound, playAccessDeniedAlarm } from '../../lib/audio-alerts';

interface AccessDecisionModalProps {
  decision: AccessDecisionResponse | null;
  isOpen: boolean;
  onClose: () => void;
  visitorPhoto?: string;
}

export const AccessDecisionModal: React.FC<AccessDecisionModalProps> = ({
  decision,
  isOpen,
  onClose,
  visitorPhoto,
}) => {
  const [copiedBadge, setCopiedBadge] = useState(false);

  useEffect(() => {
    if (!isOpen || !decision) return;

    if (decision.status === 'GRANTED') {
      playAccessGrantedSound();
    } else {
      playAccessDeniedAlarm();
    }
  }, [isOpen, decision]);

  if (!isOpen || !decision) return null;

  const isGranted = decision.status === 'GRANTED';
  const similarityPercent = (decision.similarityScore * 100).toFixed(1);

  const handlePrintBadge = () => {
    window.print();
  };

  const handleShareBadge = () => {
    if (decision.gateBadge) {
      navigator.clipboard.writeText(
        `TRIPLE C PIGS ACCESS PASS\nBadge: ${decision.gateBadge.badgeNumber}\nVisitor: ${decision.visitorName}\n${decision.idType}: ${decision.idNumber}\nCountry: ${decision.countryOfOrigin}\nExpires: ${new Date(
          decision.gateBadge.expiresAt
        ).toLocaleTimeString()}`
      );
      setCopiedBadge(true);
      setTimeout(() => setCopiedBadge(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden transition-all transform duration-300 ${
          isGranted
            ? 'bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 border-emerald-500/60 shadow-emerald-950/50'
            : 'bg-gradient-to-b from-rose-950 via-slate-900 to-slate-950 border-rose-500/70 shadow-rose-950/60'
        }`}
      >
        {/* Top Status Header Banner */}
        <div
          className={`px-6 py-5 text-center flex flex-col items-center justify-center relative ${
            isGranted
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
              : 'bg-rose-600 text-white shadow-lg shadow-rose-900/40 animate-pulse'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-widest font-black opacity-90">
              TRIPLE C PIGS (INNSCOR AFRICA LTD) • GATE DECISION ENGINE
            </span>
          </div>

          <div className="flex items-center gap-3 my-1">
            {isGranted ? (
              <CheckCircle2 className="w-10 h-10 text-white drop-shadow-md shrink-0" />
            ) : (
              <ShieldAlert className="w-10 h-10 text-white drop-shadow-md shrink-0" />
            )}
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase">
              {isGranted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
            </h1>
          </div>

          <p className="text-sm font-semibold tracking-wide text-white/95 max-w-md text-center">
            {isGranted
              ? 'Welcome to Triple C Pigs'
              : 'ACCESS DENIED / BIOSECURITY QUARANTINE HOLD'}
          </p>

          <div className="absolute right-4 top-4">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                isGranted ? 'bg-emerald-800/80 text-emerald-100' : 'bg-rose-900/80 text-rose-100'
              }`}
            >
              <Radio className="w-3 h-3 animate-ping" />
              LIVE EVAL
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 text-slate-100">
          {/* GREEN SCREEN: Temporary Gate Badge & Visitor Pass */}
          {isGranted && decision.gateBadge ? (
            <div className="space-y-4">
              {/* Badge Visual Card */}
              <div className="bg-slate-900/90 rounded-xl p-4 sm:p-5 border border-emerald-500/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5" />
                      Triple C Pigs Facility Access
                    </div>
                    <div className="text-xl font-black text-white mt-0.5">
                      {decision.visitorName}
                    </div>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1 text-slate-300">
                        <CreditCard className="w-3 h-3 text-emerald-400" />
                        {decision.idType === 'PASSPORT' ? 'Passport' : 'National ID'}: {decision.idNumber}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-300">
                        <Globe2 className="w-3 h-3 text-cyan-400" />
                        {decision.countryOfOrigin}
                      </span>
                    </div>
                  </div>

                  {visitorPhoto ? (
                    <img
                      src={visitorPhoto}
                      alt={decision.visitorName}
                      className="w-16 h-16 rounded-lg object-cover border-2 border-emerald-500 shadow-md shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-emerald-900/40 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-300 shrink-0">
                      <UserCheck className="w-8 h-8" />
                    </div>
                  )}
                </div>

                {/* Badge Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/70">
                    <span className="text-slate-400 block mb-0.5">Badge Number</span>
                    <span className="font-mono font-bold text-emerald-300 text-sm">
                      {decision.gateBadge.badgeNumber}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/70">
                    <span className="text-slate-400 block mb-0.5">Biometric Match</span>
                    <span className="font-bold text-emerald-400 flex items-center gap-1 text-sm">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      {similarityPercent}% (&gt;85% Verified)
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/70">
                    <span className="text-slate-400 block mb-0.5">Validity</span>
                    <span className="font-semibold text-slate-200 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      8 Hours (Single Entry)
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/70">
                    <span className="text-slate-400 block mb-0.5">Permitted Zones</span>
                    <span className="font-semibold text-emerald-300">
                      Admin &amp; Logistics Bay
                    </span>
                  </div>
                </div>

                {/* Simulated QR Code Bar */}
                <div className="bg-white p-3 rounded-lg flex items-center justify-between text-slate-900">
                  <div className="flex items-center gap-2.5">
                    <QrCode className="w-8 h-8 text-emerald-950 shrink-0" />
                    <div>
                      <div className="text-xs font-black uppercase tracking-tight">
                        TRIPLE C PIGS GATE CLEARANCE TOKEN
                      </div>
                      <div className="text-[10px] text-slate-600 font-mono">
                        HASH: {decision.decisionId}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded">
                    POSTGRES: CHECKED_IN
                  </span>
                </div>
              </div>

              {/* Action Buttons for Gate Guard */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handlePrintBadge}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-900/30 active:scale-[0.98]"
                >
                  <Printer className="w-4 h-4" />
                  Print / Issue Gate Badge
                </button>

                <button
                  type="button"
                  onClick={handleShareBadge}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition active:scale-[0.98]"
                >
                  {copiedBadge ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      Copy Token
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {/* RED SCREEN: Prominent Denial & Quarantine Alert */}
          {!isGranted ? (
            <div className="space-y-4">
              <div className="bg-rose-950/60 rounded-xl p-4 sm:p-5 border border-rose-500/40 text-rose-100">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Protocol Quarantine Lockdown Activated
                </div>

                <div className="text-lg font-bold text-white mb-2">
                  Visitor Access Strictly Prohibited
                </div>

                <div className="text-xs text-slate-300 font-mono flex items-center gap-2 mb-3 bg-slate-950/70 p-2.5 rounded-lg border border-rose-900/60">
                  <span className="text-white font-bold">{decision.visitorName}</span>
                  <span>•</span>
                  <span>{decision.idType}: {decision.idNumber}</span>
                  <span>•</span>
                  <span className="text-cyan-300">{decision.countryOfOrigin}</span>
                </div>

                <p className="text-xs text-rose-200/90 leading-relaxed mb-4">
                  The gate decision engine evaluated biosecurity questions and identity parameters against
                  strict Triple C Pigs swine herd biosecurity containment
                  protocols. The following mandatory rule violations occurred:
                </p>

                {/* Specific Denial Breakdown */}
                <div className="space-y-2 mb-4">
                  {decision.denialReasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/80 p-3 rounded-lg border border-rose-900/70 text-xs flex items-start gap-2.5"
                    >
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-mono font-bold text-rose-300 text-[11px]">
                          [{reason.code}]
                        </div>
                        <div className="text-slate-200 mt-0.5 leading-snug">
                          {reason.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Biometric Diagnostic Score */}
                <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Biometric Similarity:</span>
                  <span
                    className={`font-bold ${
                      decision.similarityScore >= 0.85 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {similarityPercent}% (Threshold: &gt;85.0% Required)
                  </span>
                </div>
              </div>

              {/* Automatic Alerts Status Box */}
              <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 text-xs space-y-1.5">
                <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                  Automated Security Dispatches Fired:
                </div>
                <div className="text-slate-400 text-[11px] space-y-1 pl-5">
                  <div>
                    ✓ <span className="text-slate-200">Instant Email Alert</span> dispatched to Triple C SOC
                  </div>
                  <div>
                    ✓ <span className="text-slate-200">Webhook Alert</span> broadcast to Triple C SOC
                  </div>
                  <div>
                    ✓ <span className="text-slate-200">PostgreSQL Log</span>: Recorded under table{' '}
                    <code className="text-rose-300 font-mono">visits</code> &amp;{' '}
                    <code className="text-rose-300 font-mono">biosecurity_alerts</code>
                  </div>
                </div>
              </div>

              {/* Instructions for Field Guard */}
              <div className="bg-amber-950/40 rounded-xl p-3 border border-amber-600/30 text-amber-200 text-xs">
                <span className="font-bold flex items-center gap-1.5 text-amber-300 mb-1">
                  <FileWarning className="w-3.5 h-3.5" />
                  Mandatory Guard SOP:
                </span>
                <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-amber-200/90">
                  <li>Direct vehicle immediately into Outer Quarantine Bay (do not pass tire dip).</li>
                  <li>Hand visitor the Biosecurity Declaration Notice.</li>
                  <li>Await security officer acknowledgment on the central dashboard.</li>
                </ol>
              </div>
            </div>
          ) : null}

          {/* Bottom Close Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] ${
                isGranted
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                  : 'bg-rose-700 hover:bg-rose-600 text-white shadow-lg shadow-rose-950/50'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Reset Scanner for Next Vehicle / Visitor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
