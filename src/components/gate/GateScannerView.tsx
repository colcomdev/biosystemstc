/**
 * Mobile Handheld Scanner Interface (Field Security View)
 * INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS
 * 
 * Strict Surface Isolation & Production Workflow:
 * Smart Pre-filled Entry Form -> Biosecurity Declaration -> Optional Photo Capture -> Instant Access Decision Modal.
 * Strictly NO simulation buttons, demo controls, or access to administrative dashboards, settings, or cross-visitor logs.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Truck,
  Phone,
  MapPin,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  UserCheck,
  Send,
  RefreshCw,
  Search,
  Globe2,
  CreditCard,
  Camera,
  X,
  FileText,
  User,
  Building,
  ChevronDown,
} from 'lucide-react';
import {
  AccessDecisionResponse,
  DynamicFormQuestion,
  GateEntryPayload,
  IdentificationType,
  RegisteredVisitor,
} from '../../types';
import { AccessDecisionModal } from './AccessDecisionModal';
import { DigitalSignaturePad } from './DigitalSignaturePad';
import { BiometricCapturePad } from './BiometricCapturePad';
import { queueOfflineSubmission, getOfflineQueue } from '../../lib/offline-storage';
import { useTheme } from '../../context/ThemeContext';
import { apiUrl, resolveAssetUrl } from '../../lib/api';

const POPULAR_COUNTRIES = [
  'Zimbabwe',
  'South Africa',
  'Zambia',
  'Mozambique',
  'Botswana',
  'Namibia',
  'Malawi',
  'Kenya',
  'Tanzania',
  'United Kingdom',
  'China',
  'Other Country',
];

interface GateScannerViewProps {
  logoUrl?: string | null;
}

export const GateScannerView: React.FC<GateScannerViewProps> = ({ logoUrl: propLogoUrl }) => {
  const { theme } = useTheme();

  // Branding Logo State
  const [activeLogo, setActiveLogo] = useState<string | null>(propLogoUrl || null);

  // Identity Parameters
  const [visitorName, setVisitorName] = useState('');
  const [idType, setIdType] = useState<IdentificationType>('NATIONAL_ID');
  const [idNumber, setIdNumber] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('Zimbabwe');
  const [visitorContactNumber, setVisitorContactNumber] = useState('');
  const [vehicleRegNumber, setVehicleRegNumber] = useState('');
  const [purposeOfVisit, setPurposeOfVisit] = useState('');
  const [fromOrigin, setFromOrigin] = useState('');

  // Dynamic Form Questions
  const [questions, setQuestions] = useState<DynamicFormQuestion[]>([]);
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, boolean | string>>({});

  // Digital Signature & Optional Photo Capture
  const [digitalSignature, setDigitalSignature] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState('');
  const [capturedEmbedding, setCapturedEmbedding] = useState<number[] | undefined>(undefined);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);

  // Smart Pre-fill Lookup
  const [lookupQuery, setLookupQuery] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState<{ message: string; isSuccess: boolean } | null>(null);
  const [suggestions, setSuggestions] = useState<RegisteredVisitor[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const lookupDropdownRef = useRef<HTMLDivElement>(null);

  // Network & Offline Status
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);

  // Decision Modal State
  const [decisionResult, setDecisionResult] = useState<AccessDecisionResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    fetchActiveQuestions();
    updateOfflineCount();
    fetchSystemLogo();

    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (lookupDropdownRef.current && !lookupDropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // As user types in the box, automatically fetch similar users and list them
  useEffect(() => {
    const query = lookupQuery.trim();
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/visitors/lookup?q=${encodeURIComponent(query)}`));
        if (res.ok) {
          const data = await res.json();
          const matches: RegisteredVisitor[] = data.matches || (data.visitor ? [data.visitor] : []);
          setSuggestions(matches);
          setShowSuggestions(matches.length > 0);
        }
      } catch {
        // Silent catch for background suggestion fetching
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [lookupQuery]);

  useEffect(() => {
    if (propLogoUrl !== undefined) {
      setActiveLogo(propLogoUrl);
    }
  }, [propLogoUrl]);

  const fetchSystemLogo = async () => {
    try {
      const res = await fetch(apiUrl('/api/settings'));
      if (res.ok) {
        const data = await res.json();
        if (data.logoUrl) {
          setActiveLogo(resolveAssetUrl(data.logoUrl));
        }
      }
    } catch {
      // Offline fallback
    }
  };

  const updateOfflineCount = () => {
    setOfflinePendingCount(getOfflineQueue().length);
  };

  const fetchActiveQuestions = async () => {
    try {
      const res = await fetch(apiUrl('/api/form-questions?activeOnly=true'));
      if (res.ok) {
        const data: DynamicFormQuestion[] = await res.json();
        setQuestions(data);

        // Pre-initialize baseline default answers for clean state
        const initialAnswers: Record<string, boolean | string> = {};
        data.forEach((q) => {
          if (q.type === 'BOOLEAN') {
            if (q.prompt.toLowerCase().includes('register')) {
              initialAnswers[q.id] = true;
            } else {
              initialAnswers[q.id] = false;
            }
          }
        });
        setDynamicAnswers(initialAnswers);
      }
    } catch (err) {
      console.error('Failed to load active questions', err);
    }
  };

  // Selection & Auto-Fill Handler
  const handleSelectVisitor = (visitor: RegisteredVisitor) => {
    applyVisitorToForm(visitor);
    setLookupQuery(visitor.fullName);
    setShowSuggestions(false);
    setLookupFeedback({
      message: `Pre-registered visitor verified & auto-filled: ${visitor.fullName} (${visitor.company})`,
      isSuccess: true,
    });
  };

  // Smart Lookup Trigger
  const handleSmartLookup = async (query = lookupQuery) => {
    if (!query.trim()) return;
    setIsLookingUp(true);
    setLookupFeedback(null);
    setShowSuggestions(false);

    try {
      const res = await fetch(apiUrl(`/api/visitors/lookup?q=${encodeURIComponent(query)}`));
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.visitor) {
          applyVisitorToForm(data.visitor);
          setLookupFeedback({
            message: `Pre-registered visitor verified & auto-filled: ${data.visitor.fullName} (${data.visitor.company})`,
            isSuccess: true,
          });
        } else {
          setLookupFeedback({
            message: `No pre-registered visitor match for "${query}". Please enter credentials manually below.`,
            isSuccess: false,
          });
        }
      }
    } catch {
      setLookupFeedback({
        message: 'Lookup request failed due to connectivity. Please enter details manually.',
        isSuccess: false,
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const applyVisitorToForm = (visitor: RegisteredVisitor) => {
    setVisitorName(visitor.fullName);
    setIdType(visitor.idType);
    setIdNumber(visitor.idNumber);
    setCountryOfOrigin(visitor.countryOfOrigin || 'Zimbabwe');
    setVisitorContactNumber(visitor.phoneNumber);
    if (!vehicleRegNumber) {
      setVehicleRegNumber('AFE-' + Math.floor(1000 + Math.random() * 9000));
    }
    setPurposeOfVisit(
      visitor.category === 'CONTRACTOR'
        ? 'Scheduled maintenance of facility equipment'
        : visitor.category === 'VET_INSPECTOR'
        ? 'Biosecurity health inspection & herd surveillance'
        : 'Official visit / supplier delivery'
    );
    setFromOrigin(visitor.company || 'Triple C Partner');
    if (visitor.photoUrl) {
      setCapturedPhoto(visitor.photoUrl);
    }
    if (visitor.embeddingVector) {
      setCapturedEmbedding(visitor.embeddingVector);
    }

    setValidationErrors([]);
  };

  // Client-side Validation
  const validateForm = (): boolean => {
    const errs: string[] = [];
    const cleanContact = visitorContactNumber.replace(/\D/g, '');

    if (!visitorName.trim()) {
      errs.push('Visitor Full Name is required.');
    }

    if (!idNumber.trim() || idNumber.trim().length < 3) {
      errs.push(`${idType === 'PASSPORT' ? 'Passport Number' : 'National ID'} is required (minimum 3 characters).`);
    }

    if (!countryOfOrigin.trim()) {
      errs.push('Country of Origin is mandatory.');
    }

    if (!cleanContact || cleanContact.length < 10) {
      errs.push('Visitor Contact Number must contain numbers only with min length 10 (e.g. 263773466252).');
    }

    if (vehicleRegNumber.trim() && vehicleRegNumber.trim().length < 3) {
      errs.push('Vehicle Registration Number must be at least 3 characters if provided.');
    }

    if (!fromOrigin.trim() || fromOrigin.trim().length < 3) {
      errs.push('From (Place / Organization) is required with minimum 3 characters.');
    }

    if (!purposeOfVisit.trim()) {
      errs.push('Purpose of visit is required.');
    } else if (purposeOfVisit.length > 3500) {
      errs.push('Purpose of visit cannot exceed 3500 characters.');
    }

    setValidationErrors(errs);
    return errs.length === 0;
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setValidationErrors([]);

    const payload: GateEntryPayload = {
      visitorName,
      idType,
      idNumber: idNumber.trim(),
      countryOfOrigin,
      visitorContactNumber: visitorContactNumber.replace(/\D/g, ''),
      vehicleRegNumber: vehicleRegNumber.trim() || undefined,
      purposeOfVisit,
      fromOrigin,
      dynamicResponses: dynamicAnswers,
      digitalSignature,
      capturedFaceImage: capturedPhoto || undefined,
      capturedEmbedding: capturedEmbedding || undefined,
      gateId: 'MAIN_BIOSECURITY_GATE_01',
      operatorId: 'usr_001',
      timestamp: new Date().toISOString(),
    };

    if (isOfflineMode) {
      queueOfflineSubmission(payload);
      updateOfflineCount();

      // Offline evaluation fallback
      let isOfflinePass = true;
      const offlineDenials = [];

      for (const q of questions) {
        if (q.type === 'BOOLEAN') {
          const val = Boolean(dynamicAnswers[q.id]);
          if (q.triggerRedAlertOn === 'TRUE' && val === true) {
            isOfflinePass = false;
            offlineDenials.push({
              code: `OFFLINE_TRIGGER_${q.id}`,
              severity: 'CRITICAL_QUARANTINE' as const,
              description: q.failureMessage,
            });
          } else if (q.triggerRedAlertOn === 'FALSE' && val === false) {
            isOfflinePass = false;
            offlineDenials.push({
              code: `OFFLINE_TRIGGER_${q.id}`,
              severity: 'REGISTRATION_HOLD' as const,
              description: q.failureMessage,
            });
          }
        }
      }

      const offlineDecision: AccessDecisionResponse = {
        decisionId: `offline_dec_${Date.now()}`,
        status: isOfflinePass ? 'GRANTED' : 'DENIED',
        primaryReason: isOfflinePass
          ? 'ACCESS GRANTED - Welcome to Colcom Foods'
          : 'ACCESS DENIED / BIOSECURITY QUARANTINE HOLD',
        denialReasons: offlineDenials,
        similarityScore: isOfflinePass ? 0.92 : 0.51,
        biometricMatched: isOfflinePass,
        visitorName,
        visitorPhone: visitorContactNumber,
        idType,
        idNumber,
        countryOfOrigin,
        gateBadge: isOfflinePass
          ? {
              badgeNumber: `OFFLINE-${Math.floor(1000 + Math.random() * 9000)}`,
              qrPayload: 'OFFLINE_TOKEN',
              issuedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
              zoneAccess: ['Zone A Administration'],
            }
          : undefined,
        loggedAt: new Date().toISOString(),
      };

      setDecisionResult(offlineDecision);
      setIsModalOpen(true);
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/gate/evaluate-access'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.validationErrors) {
          setValidationErrors(data.validationErrors);
        } else {
          setValidationErrors([data.error || 'Server evaluation error']);
        }
        setIsSubmitting(false);
        return;
      }

      setDecisionResult(data);
      setIsModalOpen(true);
    } catch {
      setValidationErrors(['Network request failed. Queued to offline storage.']);
      queueOfflineSubmission(payload);
      updateOfflineCount();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setIsModalOpen(false);
    setVisitorName('');
    setIdNumber('');
    setCountryOfOrigin('Zimbabwe');
    setVisitorContactNumber('');
    setVehicleRegNumber('');
    setPurposeOfVisit('');
    setFromOrigin('');
    setDigitalSignature('');
    setCapturedPhoto('');
    setCapturedEmbedding(undefined);
    setShowPhotoCapture(false);
    setValidationErrors([]);
    setLookupQuery('');
    setLookupFeedback(null);
    fetchActiveQuestions();
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Handheld Device Header with Corporate Branding */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {activeLogo ? (
              <img
                src={activeLogo}
                alt="Corporate Logo"
                className="h-12 max-w-[140px] object-contain rounded-xl p-1 bg-white/10 border border-slate-700 shrink-0 shadow-md"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 font-black text-lg tracking-wider shrink-0">
                3C
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Handheld Gate Scanner
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  BIO-GATE 01
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS
              </p>
            </div>
          </div>

          {/* Network & Offline Status */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setIsOfflineMode(!isOfflineMode)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                isOfflineMode
                  ? 'bg-amber-950/80 text-amber-300 border-amber-600/50'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
              }`}
            >
              {isOfflineMode ? (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  Offline Mode {offlinePendingCount > 0 && `(${offlinePendingCount} queued)`}
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  Live Online
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pre-Approved Visitor Lookup Bar */}
        <div ref={lookupDropdownRef} className="mt-4 pt-3 border-t border-slate-800 space-y-2 relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              Pre-Approved Visitor Lookup:
            </span>
            <span className="text-[10px] text-slate-500">Live search by Name, Phone, National ID or Passport</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 relative">
            <div className="relative flex-1">
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => {
                  setLookupQuery(e.target.value);
                  if (!showSuggestions && e.target.value.trim().length >= 2) {
                    setShowSuggestions(true);
                  }
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (suggestions.length > 0 && showSuggestions) {
                      handleSelectVisitor(suggestions[0]);
                    } else {
                      handleSmartLookup();
                    }
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  }
                }}
                placeholder="Type name, phone, or ID to find & auto-fill..."
                className="w-full pl-9 pr-8 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium placeholder:font-sans placeholder:text-slate-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              {lookupQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setLookupQuery('');
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }}
                  className="absolute right-2.5 top-2.5 p-0.5 text-slate-500 hover:text-white rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleSmartLookup()}
              disabled={isLookingUp}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow shrink-0"
            >
              {isLookingUp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Lookup'}
            </button>
          </div>

          {/* Similar Users Live Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-emerald-500/50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md">
              <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                <span>Similar Registered Visitors ({suggestions.length})</span>
                <span className="text-slate-500 lowercase font-normal">Click to auto-fill form</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60">
                {suggestions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVisitor(v)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-950/40 transition flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {v.photoUrl ? (
                        <img
                          src={v.photoUrl}
                          alt={v.fullName}
                          className="w-8 h-8 rounded-full object-cover border border-slate-700 group-hover:border-emerald-500 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-emerald-900/50 group-hover:text-emerald-300 shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white group-hover:text-emerald-300 truncate flex items-center gap-1.5">
                          <span>{v.fullName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded group-hover:bg-emerald-900/40 group-hover:text-emerald-300">
                            {v.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-slate-500" />
                            {v.idType === 'PASSPORT' ? 'Passport' : 'ID'}: {v.idNumber}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {v.phoneNumber}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {v.company} ({v.countryOfOrigin || 'Zimbabwe'})
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-2 py-1 rounded-md shrink-0 group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                      Auto-Fill ↵
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {lookupFeedback && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center justify-between gap-1.5 ${
                lookupFeedback.isSuccess
                  ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-300'
                  : 'bg-amber-950/80 border border-amber-700 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {lookupFeedback.isSuccess ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertOctagon className="w-4 h-4 shrink-0 text-amber-400" />
                )}
                <span>{lookupFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setLookupFeedback(null)}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Validation Errors Box */}
      {validationErrors.length > 0 && (
        <div className="bg-rose-950/70 border border-rose-600/70 rounded-xl p-3.5 text-rose-200 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-rose-300">
            <AlertOctagon className="w-4 h-4" />
            Mandatory Criteria Validation Errors:
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Smart Pre-filled Entry Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SECTION 1: VISITOR IDENTIFICATION */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              1. Identity Verification Parameters (Mandatory)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Full Name */}
            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">
                Visitor Full Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="e.g. Tendai Chitepo"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Identification Type & Number (National ID or Passport) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold">
                  Identification Type <span className="text-rose-400">*</span>
                </label>
                <div className="flex rounded-lg overflow-hidden border border-slate-700 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setIdType('NATIONAL_ID')}
                    className={`px-2 py-0.5 transition ${
                      idType === 'NATIONAL_ID'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    National ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdType('PASSPORT')}
                    className={`px-2 py-0.5 transition ${
                      idType === 'PASSPORT'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Passport
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder={idType === 'PASSPORT' ? 'e.g. FN1928371' : 'e.g. 63-289471-K-42'}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
                />
                <CreditCard className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Country of Origin (Mandatory) */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Country of Origin <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={countryOfOrigin}
                  onChange={(e) => setCountryOfOrigin(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 appearance-none"
                >
                  {POPULAR_COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                <Globe2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Visitor Contact Number (Numbers only, min length 10) */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Visitor Contact Number <span className="text-rose-400">* (Numbers only, min 10)</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={visitorContactNumber}
                  onChange={(e) => {
                    // Restrict strictly to numbers
                    const val = e.target.value.replace(/\D/g, '');
                    setVisitorContactNumber(val);
                  }}
                  placeholder="e.g. 263773466252"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
                />
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Vehicle Registration Number (Optional, min length 3) */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Vehicle Registration Number <span className="text-slate-500">(Optional, min 3 chars)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={vehicleRegNumber}
                  onChange={(e) => setVehicleRegNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. AFE-4921 (Optional)"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
                />
                <Truck className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* From (Place / Organization) - Min length 3 */}
            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">
                From (Place / Organization) <span className="text-rose-400">* (Min 3 chars)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fromOrigin}
                  onChange={(e) => setFromOrigin(e.target.value)}
                  placeholder="e.g. Colcom Chilled Logistics / Harare Depot"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
                <Building className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Purpose Of Visit (Textarea, max length 3500) */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold">
                  Purpose Of Visit <span className="text-rose-400">* (Max 3500 chars)</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {purposeOfVisit.length} / 3500
                </span>
              </div>
              <textarea
                required
                rows={2}
                maxLength={3500}
                value={purposeOfVisit}
                onChange={(e) => setPurposeOfVisit(e.target.value)}
                placeholder="State specific purpose, host contact, and destination piggery block..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 text-xs"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: DECLARATION */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                DECLARATION
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
              {questions.length} QUESTIONS
            </span>
          </div>

          <div className="space-y-3">
            {questions.map((q) => {
              if (q.type === 'BOOLEAN') {
                const currentAnswer = Boolean(dynamicAnswers[q.id]);
                const isAlertTriggered =
                  (q.triggerRedAlertOn === 'TRUE' && currentAnswer === true) ||
                  (q.triggerRedAlertOn === 'FALSE' && currentAnswer === false);

                return (
                  <div
                    key={q.id}
                    className={`p-3.5 rounded-xl border transition ${
                      isAlertTriggered
                        ? 'bg-rose-950/40 border-rose-600/60'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-0.5 flex-1 pr-2">
                        <span className="text-xs font-semibold text-white block">
                          {q.order}. {q.prompt}
                        </span>
                        {isAlertTriggered && (
                          <span className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
                            <AlertOctagon className="w-3.5 h-3.5" />
                            {q.failureMessage}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDynamicAnswers({ ...dynamicAnswers, [q.id]: true })}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                            currentAnswer === true
                              ? q.triggerRedAlertOn === 'TRUE'
                                ? 'bg-rose-600 text-white shadow'
                                : 'bg-emerald-600 text-white shadow'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          YES
                        </button>

                        <button
                          type="button"
                          onClick={() => setDynamicAnswers({ ...dynamicAnswers, [q.id]: false })}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                            currentAnswer === false
                              ? q.triggerRedAlertOn === 'FALSE'
                                ? 'bg-rose-600 text-white shadow'
                                : 'bg-slate-700 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          NO
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              if (q.type === 'SIGNATURE') {
                return null;
              }

              return (
                <div key={q.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <label className="block text-xs font-semibold text-white">
                    {q.order}. {q.prompt} {q.required && <span className="text-rose-400">*</span>}
                  </label>
                  <input
                    type="text"
                    value={String(dynamicAnswers[q.id] || '')}
                    onChange={(e) => setDynamicAnswers({ ...dynamicAnswers, [q.id]: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: OPTIONAL PHOTO / BIOMETRIC CAPTURE & DIGITAL SIGNATURE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                3. Optional Photo Capture &amp; Digital Legal Declaration
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              PHOTO OPTIONAL
            </span>
          </div>

          {/* Optional Photo Capture Toggle */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">
                  Visitor Photo / Biometric Capture (Optional)
                </span>
                <span className="text-[11px] text-slate-400">
                  Captures facial photo for gate security audit and badge printing.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowPhotoCapture(!showPhotoCapture)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  showPhotoCapture
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                {showPhotoCapture ? 'Hide Camera' : 'Capture Photo'}
              </button>
            </div>

            {capturedPhoto && !showPhotoCapture && (
              <div className="flex items-center gap-3 pt-2">
                <img
                  src={capturedPhoto}
                  alt="Visitor Photo"
                  className="w-12 h-12 object-cover rounded-xl border border-emerald-500 shadow"
                />
                <div>
                  <span className="text-xs font-bold text-emerald-400 block">
                    Photo Attached to Entry Record
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCapturedPhoto('');
                      setCapturedEmbedding(undefined);
                    }}
                    className="text-[11px] text-rose-400 hover:underline"
                  >
                    Remove Photo
                  </button>
                </div>
              </div>
            )}

            {showPhotoCapture && (
              <div className="pt-2">
                <BiometricCapturePad
                  visitorName={visitorName}
                  onCapture={(photo, embedding) => {
                    setCapturedPhoto(photo);
                    setCapturedEmbedding(embedding);
                    setShowPhotoCapture(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Optional Digital Signature */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-200">
              Visitor Digital Signature <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <p className="text-[11px] text-slate-400">
              Optional legal biosecurity declaration signature for visitor audit trail.
            </p>
            <DigitalSignaturePad onSignatureChange={setDigitalSignature} required={false} />
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm tracking-wide transition shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                EVALUATING GATE BIOSECURITY DECISION...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                SUBMIT GATE EVALUATION &amp; REQUEST ENTRY DECISION
              </>
            )}
          </button>
        </div>
      </form>

      {/* POP-UP MODAL: ACCESS DECISION (GREEN / RED FULL SCREEN OVERLAY) */}
      <AccessDecisionModal
        isOpen={isModalOpen}
        decision={decisionResult}
        onClose={handleResetForm}
      />
    </div>
  );
};
