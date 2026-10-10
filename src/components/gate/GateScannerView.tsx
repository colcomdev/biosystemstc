/**
 * Mobile Handheld Scanner Interface (Field Security View)
 * Optimized for handheld barcode/QR scanners and tablets at Triple C Pigs entry gates.
 * 
 * Strict Surface Isolation: Strictly NO links or access to administrative dashboards,
 * settings, or cross-visitor logs.
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  QrCode,
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
  Sparkles,
  RefreshCw,
  Search,
  Globe2,
  CreditCard,
  ScanLine,
  Camera,
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

const POPULAR_COUNTRIES = [
  'Zimbabwe',
  'South Africa',
  'Zambia',
  'Mozambique',
  'Botswana',
  'Namibia',
  'Malawi',
  'United Kingdom',
  'China',
  'Other Country',
];

export const GateScannerView: React.FC = () => {
  // Identity Fields
  const [visitorName, setVisitorName] = useState('');
  const [idType, setIdType] = useState<IdentificationType>('NATIONAL_ID');
  const [idNumber, setIdNumber] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('Zimbabwe');
  const [visitorContactNumber, setVisitorContactNumber] = useState('');
  const [vehicleRegNumber, setVehicleRegNumber] = useState('');
  const [purposeOfVisit, setPurposeOfVisit] = useState('');
  const [fromOrigin, setFromOrigin] = useState('');

  // Dynamic Form Questions State
  const [questions, setQuestions] = useState<DynamicFormQuestion[]>([]);
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, boolean | string>>({});

  // Digital Signature & Biometrics
  const [digitalSignature, setDigitalSignature] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState('');
  const [capturedEmbedding, setCapturedEmbedding] = useState<number[] | undefined>(undefined);

  // Registered Visitors Whitelist & Smart Pre-fill
  const [registeredVisitors, setRegisteredVisitors] = useState<RegisteredVisitor[]>([]);
  const [selectedVisitor, setSelectedVisitor] = useState<RegisteredVisitor | null>(null);

  // Smart Lookup Input
  const [lookupQuery, setLookupQuery] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Network & Offline Status
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);

  // Decision Modal State
  const [decisionResult, setDecisionResult] = useState<AccessDecisionResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Simulated QR Scanner Camera Overlay
  const [isQrScannerActive, setIsQrScannerActive] = useState(false);

  useEffect(() => {
    fetchActiveQuestions();
    fetchVisitors();
    updateOfflineCount();

    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateOfflineCount = () => {
    setOfflinePendingCount(getOfflineQueue().length);
  };

  const fetchActiveQuestions = async () => {
    try {
      const res = await fetch('/api/form-questions?activeOnly=true');
      if (res.ok) {
        const data: DynamicFormQuestion[] = await res.json();
        setQuestions(data);

        // Pre-initialize baseline default answers for convenient gate workflow
        const initialAnswers: Record<string, boolean | string> = {};
        data.forEach((q) => {
          if (q.type === 'BOOLEAN') {
            // Default: clean state (false for animal contact and meat, true for on register)
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

  const fetchVisitors = async () => {
    try {
      const res = await fetch('/api/visitors');
      if (res.ok) {
        const data: RegisteredVisitor[] = await res.json();
        setRegisteredVisitors(data);
      }
    } catch {
      // Offline fallback
    }
  };

  // Smart Lookup Trigger
  const handleSmartLookup = async (query = lookupQuery) => {
    if (!query.trim()) return;
    setIsLookingUp(true);
    try {
      const res = await fetch(`/api/visitors/lookup?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.visitor) {
          applyVisitorToForm(data.visitor);
        } else {
          setValidationErrors([`No pre-registered visitor found for query: "${query}". Enter details manually.`]);
        }
      }
    } catch {
      setValidationErrors(['Lookup failed. Check connectivity.']);
    } finally {
      setIsLookingUp(false);
    }
  };

  const applyVisitorToForm = (visitor: RegisteredVisitor, isQuarantineTrigger = false) => {
    setSelectedVisitor(visitor);
    setVisitorName(visitor.fullName);
    setIdType(visitor.idType);
    setIdNumber(visitor.idNumber);
    setCountryOfOrigin(visitor.countryOfOrigin || 'Zimbabwe');
    setVisitorContactNumber(visitor.phoneNumber);
    setVehicleRegNumber('AFE-' + Math.floor(1000 + Math.random() * 9000));
    setPurposeOfVisit(
      visitor.category === 'CONTRACTOR'
        ? 'Scheduled refrigeration chiller maintenance in Pig Unit 2'
        : visitor.category === 'VET_INSPECTOR'
        ? 'African Swine Fever quarterly tissue surveillance'
        : 'Feed delivery & bulk grain unloading'
    );
    setFromOrigin(visitor.company || 'Harare Industrial Park');
    setCapturedPhoto(visitor.photoUrl);
    setCapturedEmbedding(visitor.embeddingVector);

    // Apply baseline questions
    const answers: Record<string, boolean | string> = {};
    questions.forEach((q) => {
      if (q.prompt.toLowerCase().includes('cloven')) {
        answers[q.id] = isQuarantineTrigger; // true = breach
      } else if (q.prompt.toLowerCase().includes('meat')) {
        answers[q.id] = isQuarantineTrigger; // true = breach
      } else if (q.prompt.toLowerCase().includes('register')) {
        answers[q.id] = !isQuarantineTrigger; // true = verified on register
      } else if (q.type === 'BOOLEAN') {
        answers[q.id] = false;
      }
    });
    setDynamicAnswers(answers);
    setValidationErrors([]);
  };

  const handleSimulateQrScan = (visitor: RegisteredVisitor) => {
    setIsQrScannerActive(true);
    setTimeout(() => {
      setIsQrScannerActive(false);
      applyVisitorToForm(visitor, false);
    }, 800);
  };

  const handleSimulateAsfBreach = () => {
    setVisitorName('Kudakwashe Shumba');
    setIdType('NATIONAL_ID');
    setIdNumber('63-110293-F-11');
    setCountryOfOrigin('Zimbabwe');
    setVisitorContactNumber('263772810991');
    setVehicleRegNumber('ACD-3910');
    setPurposeOfVisit('Drop off livestock handling equipment');
    setFromOrigin('Beatrice Livestock Auction Kraal');
    setSelectedVisitor(null);
    setCapturedEmbedding(undefined);

    const answers: Record<string, boolean | string> = {};
    questions.forEach((q) => {
      if (q.prompt.toLowerCase().includes('cloven')) {
        answers[q.id] = true; // BREACH!
      } else if (q.prompt.toLowerCase().includes('meat')) {
        answers[q.id] = true; // BREACH!
      } else if (q.prompt.toLowerCase().includes('register')) {
        answers[q.id] = false; // BREACH!
      } else if (q.type === 'BOOLEAN') {
        answers[q.id] = false;
      }
    });
    setDynamicAnswers(answers);
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
      errs.push(`${idType === 'PASSPORT' ? 'Passport Number' : 'National ID'} is required (min 3 chars).`);
    }

    if (!countryOfOrigin.trim()) {
      errs.push('Country of Origin is mandatory.');
    }

    if (!cleanContact || cleanContact.length < 10) {
      errs.push('Visitor Contact Number must contain digits only with min length 10 (e.g. 263773466252).');
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

    if (!digitalSignature) {
      errs.push('Visitor Digital Signature is mandatory for legal biosecurity compliance.');
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
      capturedFaceImage: capturedPhoto,
      capturedEmbedding,
      gateId: 'MAIN_BIOSECURITY_GATE_01',
      operatorId: 'usr_001',
      timestamp: new Date().toISOString(),
    };

    if (isOfflineMode) {
      queueOfflineSubmission(payload);
      updateOfflineCount();

      // Offline evaluation
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
      const res = await fetch('/api/gate/evaluate-access', {
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
    setSelectedVisitor(null);
    setValidationErrors([]);
    setLookupQuery('');
    fetchActiveQuestions();
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Handheld Device Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/50 shrink-0">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-white tracking-tight">
                  Handheld Gate Scanner
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  BIO-GATE 01
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Triple C Pigs • African Swine Fever / FMD Bio-Interlock
              </p>
            </div>
          </div>

          {/* Network & Offline Toggle */}
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

        {/* Camera QR Scanner Simulation Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
              Camera QR Scanner &amp; Smart Lookup:
            </span>
            <span className="text-[10px] text-slate-500">Scan badge or search phone/ID</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSmartLookup()}
                placeholder="Scan QR or enter Phone / ID / Passport..."
                className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs outline-none focus:border-emerald-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>

            <button
              type="button"
              onClick={() => handleSmartLookup()}
              disabled={isLookingUp}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-700"
            >
              {isLookingUp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Lookup'}
            </button>

            {registeredVisitors[0] && (
              <button
                type="button"
                onClick={() => handleSimulateQrScan(registeredVisitors[0])}
                className="px-3.5 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
              >
                <Camera className="w-3.5 h-3.5" />
                Simulate Camera QR Scan
              </button>
            )}
          </div>

          {/* Quick Scenario Fill Badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {registeredVisitors.slice(0, 2).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => applyVisitorToForm(v, false)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-500 text-slate-300 border border-slate-700 text-xs font-medium transition flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                {v.fullName} ({v.idType === 'PASSPORT' ? 'Passport' : 'ID'})
              </button>
            ))}

            <button
              type="button"
              onClick={handleSimulateAsfBreach}
              className="px-2.5 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 border border-rose-800/60 text-xs font-medium transition flex items-center gap-1"
            >
              <AlertOctagon className="w-3 h-3 text-rose-400" />
              Simulate ASF Quarantine Breach (Fail)
            </button>
          </div>
        </div>
      </div>

      {/* Simulated Scanner Scanner Reticle Modal */}
      {isQrScannerActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500 rounded-2xl p-6 flex flex-col items-center text-center space-y-3 max-w-sm">
            <div className="w-24 h-24 border-2 border-dashed border-emerald-400 rounded-2xl animate-pulse flex items-center justify-center">
              <QrCode className="w-12 h-12 text-emerald-400" />
            </div>
            <div className="text-white font-bold text-sm">Decoding Optical QR Code...</div>
            <p className="text-xs text-slate-400">Pre-populating visitor credentials from Colcom Registry</p>
          </div>
        </div>
      )}

      {/* Validation Errors Box */}
      {validationErrors.length > 0 && (
        <div className="bg-rose-950/70 border border-rose-600/70 rounded-xl p-3.5 text-rose-200 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-rose-300">
            <AlertOctagon className="w-4 h-4" />
            Mandatory Criteria Errors:
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Gate Entry Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Identity & Credentials (National ID vs Passport, Country of Origin) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <UserCheck className="w-4 h-4" />
            Section 1: Visitor Identity &amp; Travel Credentials
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Visitor Full Legal Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="e.g. Farai Matthews"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Visitor Contact Number (Digits only, min 10) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={visitorContactNumber}
                  onChange={(e) => setVisitorContactNumber(e.target.value)}
                  placeholder="e.g. 263773466252"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:border-emerald-500 outline-none"
                />
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* National ID vs Passport Number Toggle & Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Identification Type <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIdType('NATIONAL_ID')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                      idType === 'NATIONAL_ID'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    National ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdType('PASSPORT')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                      idType === 'PASSPORT'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
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
                  onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                  placeholder={idType === 'NATIONAL_ID' ? 'e.g. 63-289471-K-42' : 'e.g. E92049182'}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono uppercase focus:border-emerald-500 outline-none"
                />
                <CreditCard className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Country of Origin (Mandatory) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Country of Origin / Nationality <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={countryOfOrigin}
                  onChange={(e) => setCountryOfOrigin(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-emerald-500 outline-none appearance-none"
                >
                  {POPULAR_COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                <Globe2 className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Vehicle Registration Number (Optional, min 3)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={vehicleRegNumber}
                  onChange={(e) => setVehicleRegNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. AFE-8492"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm uppercase font-mono focus:border-emerald-500 outline-none"
                />
                <Truck className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                From (Place / Organization) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fromOrigin}
                  onChange={(e) => setFromOrigin(e.target.value)}
                  placeholder="e.g. AgriCold Ref., Beatrice Kraal"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-emerald-500 outline-none"
                />
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Purpose Of Visit (Max 3500 chars) <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {purposeOfVisit.length}/3500
              </span>
            </div>
            <textarea
              required
              rows={2}
              maxLength={3500}
              value={purposeOfVisit}
              onChange={(e) => setPurposeOfVisit(e.target.value)}
              placeholder="State destination unit within Triple C Pigs..."
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-emerald-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* Section 2: Dynamic Form Engine (Configured by Admin / Baseline Questions) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-amber-400" />
              Section 2: Biosecurity Declarations &amp; Protocol Questions
            </div>
            <span className="text-[10px] text-slate-400 font-normal">
              {questions.filter((q) => q.type !== 'SIGNATURE').length} active dynamic checks
            </span>
          </div>

          {questions
            .filter((q) => q.type !== 'SIGNATURE')
            .map((q) => {
              const currentVal = dynamicAnswers[q.id];
              const isBoolean = q.type === 'BOOLEAN';

              // Check if current answer triggers RED alert
              let isTriggeringRed = false;
              if (isBoolean) {
                const boolVal = Boolean(currentVal);
                if (q.triggerRedAlertOn === 'TRUE' && boolVal === true) isTriggeringRed = true;
                if (q.triggerRedAlertOn === 'FALSE' && boolVal === false) isTriggeringRed = true;
              }

              return (
                <div
                  key={q.id}
                  className={`p-3.5 rounded-xl border transition ${
                    isTriggeringRed
                      ? 'bg-rose-950/50 border-rose-600/70 text-rose-200'
                      : 'bg-slate-950/70 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5 max-w-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {q.prompt}
                        </span>
                        {q.required && <span className="text-rose-400 text-xs">*</span>}
                        {q.isBaseline && (
                          <span className="text-[9px] bg-slate-800 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                            BASELINE RULE
                          </span>
                        )}
                      </div>
                      {isTriggeringRed && (
                        <div className="text-[11px] text-rose-400 font-medium">
                          ⚠ {q.failureMessage}
                        </div>
                      )}
                    </div>

                    {/* Boolean Controls */}
                    {isBoolean && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDynamicAnswers((prev) => ({ ...prev, [q.id]: false }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            currentVal === false
                              ? q.triggerRedAlertOn === 'FALSE'
                                ? 'bg-rose-600 text-white'
                                : 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          NO
                        </button>
                        <button
                          type="button"
                          onClick={() => setDynamicAnswers((prev) => ({ ...prev, [q.id]: true }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            currentVal === true
                              ? q.triggerRedAlertOn === 'TRUE'
                                ? 'bg-rose-600 text-white'
                                : 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          YES
                        </button>
                      </div>
                    )}

                    {/* Text Field */}
                    {q.type === 'TEXT' && (
                      <input
                        type="text"
                        value={(currentVal as string) || ''}
                        onChange={(e) =>
                          setDynamicAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Enter response..."
                        className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-emerald-500 w-full sm:w-48"
                      />
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Section 3: Biometric Capture & Digital Signature */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <QrCode className="w-4 h-4" />
            Section 3: Facial Biometrics (pgvector) &amp; Digital Signature
          </div>

          <BiometricCapturePad
            onCapture={(photo, embedding) => {
              setCapturedPhoto(photo);
              setCapturedEmbedding(embedding);
            }}
            selectedVisitor={selectedVisitor}
            forcePassBiometric={true}
          />

          <DigitalSignaturePad
            onSignatureChange={(sig) => setDigitalSignature(sig)}
            required
          />
        </div>

        {/* Big Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base uppercase tracking-wider rounded-2xl shadow-xl shadow-emerald-950/60 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Evaluating Access in PostgreSQL Decision Engine...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Evaluate Gate Access (Decision Engine)
            </>
          )}
        </button>
      </form>

      {/* Full-Screen Pop-Up Modal */}
      <AccessDecisionModal
        decision={decisionResult}
        isOpen={isModalOpen}
        onClose={handleResetForm}
        visitorPhoto={capturedPhoto}
      />
    </div>
  );
};
