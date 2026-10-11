/**
 * INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS
 * Mobile-First Responsive Gate Scanner Form
 * Features:
 * - Dynamic Company Logo Header (from Admin Settings)
 * - Light Mode / Dark Mode Theme Support with local persistence
 * - Real Backend Visitor Lookup
 * - National ID vs Passport selector
 * - Mandatory Country of Origin
 * - Dynamic Biosecurity Questions
 * - Optional Photo Capture
 * - Digital Signature Pad
 * - Instant GREEN / RED Decision Modal
 * - Zero simulation / demo controls
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Phone,
  Truck,
  MapPin,
  CreditCard,
  Globe2,
  AlertOctagon,
  Camera,
  CheckCircle2,
  XCircle,
  Sun,
  Moon,
  Search,
  Send,
  RefreshCw,
  QrCode,
  Printer,
  RotateCcw,
  UserCheck,
  Building,
  Radio,
  Clock,
  Check,
  Share2,
} from 'lucide-react';
import {
  AccessDecisionResponse,
  AppTheme,
  DynamicFormQuestion,
  GateEntryPayload,
  IdentificationType,
} from '../../types';
import { DigitalSignaturePad } from './DigitalSignaturePad';
import { apiUrl } from '../../lib/api';
import { DEFAULT_DECLARATION_QUESTIONS, getInitialDeclarationAnswers } from '../../data/defaultQuestions';

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

interface MobileScannerFormProps {
  theme: AppTheme;
  onToggleTheme: () => void;
  logoUrl: string | null;
  facilityName: string;
}

export const MobileScannerForm: React.FC<MobileScannerFormProps> = ({
  theme,
  onToggleTheme,
  logoUrl,
  facilityName,
}) => {
  // Visitor Identification State
  const [visitorName, setVisitorName] = useState('');
  const [idType, setIdType] = useState<IdentificationType>('NATIONAL_ID');
  const [idNumber, setIdNumber] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('Zimbabwe');
  const [visitorContactNumber, setVisitorContactNumber] = useState('');
  const [vehicleRegNumber, setVehicleRegNumber] = useState('');
  const [purposeOfVisit, setPurposeOfVisit] = useState('');
  const [fromOrigin, setFromOrigin] = useState('');

  // Dynamic Form Questions State (Default biosecurity questions so never blank)
  const [questions, setQuestions] = useState<DynamicFormQuestion[]>(DEFAULT_DECLARATION_QUESTIONS);
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, boolean | string>>(
    () => getInitialDeclarationAnswers(DEFAULT_DECLARATION_QUESTIONS)
  );

  // Digital Signature & Optional Photo
  const [digitalSignature, setDigitalSignature] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Real Lookup State
  const [lookupQuery, setLookupQuery] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupNotice, setLookupNotice] = useState<string | null>(null);

  // Submission & Decision Modal State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [decisionResult, setDecisionResult] = useState<AccessDecisionResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Photo Input Ref
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchActiveQuestions();
  }, []);

  const fetchActiveQuestions = async () => {
    try {
      const res = await fetch(apiUrl('/api/form-questions?activeOnly=true'));
      if (res.ok) {
        const data: DynamicFormQuestion[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setQuestions(data);

          // Pre-initialize baseline default answers for convenient gate workflow
          const initialAnswers: Record<string, boolean | string> = {};
          data.forEach((q) => {
            if (q.type === 'BOOLEAN') {
              if (q.prompt.toLowerCase().includes('register')) {
                initialAnswers[q.id] = true; // Default: assumed on register until checked
              } else {
                initialAnswers[q.id] = false; // Default: clean (no animal contact, no meat)
              }
            }
          });
          setDynamicAnswers((prev) => ({ ...initialAnswers, ...prev }));
        }
      }
    } catch (err) {
      console.warn('Using baseline African Swine Fever questions:', err);
    }
  };

  // Real Backend Visitor Lookup
  const handleBackendLookup = async (query = lookupQuery) => {
    if (!query.trim()) return;
    setIsLookingUp(true);
    setLookupNotice(null);
    try {
      const res = await fetch(apiUrl(`/api/visitors/lookup?q=${encodeURIComponent(query)}`));
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.visitor) {
          const v = data.visitor;
          setVisitorName(v.fullName);
          setIdType(v.idType || 'NATIONAL_ID');
          setIdNumber(v.idNumber);
          setCountryOfOrigin(v.countryOfOrigin || 'Zimbabwe');
          setVisitorContactNumber(v.phoneNumber);
          setFromOrigin(v.company || '');
          if (v.photoUrl) setCapturedPhoto(v.photoUrl);
          setLookupNotice(`Pre-registered record retrieved for ${v.fullName}.`);
        } else {
          setLookupNotice(`No pre-registration record found for "${query}". Please enter visitor details.`);
        }
      }
    } catch {
      setLookupNotice('Network error while querying visitor registry.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Mandatory Client Validations
  const validateForm = (): boolean => {
    const errs: string[] = [];
    const cleanContact = visitorContactNumber.replace(/\D/g, '');

    if (!visitorName.trim()) {
      errs.push('Visitor Full Legal Name is required.');
    }

    if (!idNumber.trim() || idNumber.trim().length < 3) {
      errs.push(`${idType === 'PASSPORT' ? 'Passport Number' : 'National ID'} is required (minimum 3 characters).`);
    }

    if (!countryOfOrigin.trim()) {
      errs.push('Country of Origin is mandatory.');
    }

    if (!cleanContact || cleanContact.length < 10) {
      errs.push('Visitor Contact Number must be numbers only with minimum 10 digits (e.g. 263773466252).');
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
      errs.push('Purpose of visit exceeds maximum allowed 3500 characters.');
    }

    setValidationErrors(errs);
    return errs.length === 0;
  };

  // Submit to Gate Decision Engine
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
      gateId: 'MAIN_BIOSECURITY_GATE_01',
      operatorId: 'usr_001',
      timestamp: new Date().toISOString(),
    };

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
      setValidationErrors(['Communication error with Gate Decision Engine server.']);
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
    setCapturedPhoto(null);
    setLookupQuery('');
    setLookupNotice(null);
    setValidationErrors([]);
    fetchActiveQuestions();
  };

  const isDark = theme === 'dark';

  return (
    <div className={`w-full max-w-3xl mx-auto space-y-4 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* Handheld Device Header with Corporate Logo & Theme Toggle */}
      <div
        className={`rounded-2xl p-4 sm:p-5 shadow-xl border transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-800 shadow-slate-950/40'
            : 'bg-white border-slate-200 shadow-slate-200/60'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Logo Branding */}
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Company Logo"
                className="w-12 h-12 rounded-xl object-contain bg-white p-1 border border-slate-700/50 shadow shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-lg shadow-lg shrink-0">
                3C
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                  {facilityName}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  GATE-01
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Livestock Biosecurity Interlock & Access Control
              </p>
            </div>
          </div>

          {/* Theme Mode Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className={`self-end sm:self-center p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
              isDark
                ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
            }`}
            title="Toggle Light / Dark Mode"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            <span className="text-[11px] font-semibold">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

        {/* Real Backend Visitor Lookup Bar */}
        <div className={`mt-4 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'} space-y-2`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Pre-Registration Registry Lookup:
            </span>
            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Search Phone, National ID, or Passport
            </span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBackendLookup()}
                placeholder="Enter Visitor Phone / National ID / Passport Number..."
                className={`w-full pl-9 pr-3.5 py-2 rounded-xl text-xs outline-none border transition ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
                }`}
              />
              <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>

            <button
              type="button"
              onClick={() => handleBackendLookup()}
              disabled={isLookingUp}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              {isLookingUp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
            </button>
          </div>

          {lookupNotice && (
            <div
              className={`text-xs p-2.5 rounded-lg border flex items-center gap-2 ${
                lookupNotice.includes('retrieved')
                  ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>{lookupNotice}</span>
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

      {/* Main Entry Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Visitor Identity Credentials */}
        <div
          className={`rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl border transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className={`text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5 border-b pb-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <UserCheck className="w-4 h-4" />
            Section 1: Visitor Identification &amp; Travel Credentials
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Visitor Full Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="e.g. Farai Matthews"
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Visitor Contact Number (Digits only, min 10) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={visitorContactNumber}
                  onChange={(e) => setVisitorContactNumber(e.target.value)}
                  placeholder="e.g. 263773466252"
                  className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm font-mono border outline-none transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
                  }`}
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* National ID vs Passport Selector & Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Document Type <span className="text-rose-500">*</span>
                </label>
                <div className={`flex items-center rounded-lg p-0.5 border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                  <button
                    type="button"
                    onClick={() => setIdType('NATIONAL_ID')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                      idType === 'NATIONAL_ID'
                        ? 'bg-emerald-600 text-white'
                        : isDark ? 'text-slate-400' : 'text-slate-600'
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
                        : isDark ? 'text-slate-400' : 'text-slate-600'
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
                  className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm font-mono uppercase border outline-none transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
                  }`}
                />
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Mandatory Country of Origin */}
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Country of Origin / Nationality <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={countryOfOrigin}
                  onChange={(e) => setCountryOfOrigin(e.target.value)}
                  className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm border outline-none appearance-none transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
                  }`}
                >
                  {POPULAR_COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                <Globe2 className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Vehicle Registration Number (Optional, min 3)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={vehicleRegNumber}
                  onChange={(e) => setVehicleRegNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. AFE-8492"
                  className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm uppercase font-mono border outline-none transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
                  }`}
                />
                <Truck className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                From (Place / Organization) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fromOrigin}
                  onChange={(e) => setFromOrigin(e.target.value)}
                  placeholder="e.g. AgriCold Services, Beatrice Kraal"
                  className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm border outline-none transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
                  }`}
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Purpose Of Visit (Max 3500 chars) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {purposeOfVisit.length}/3500
              </span>
            </div>
            <textarea
              required
              rows={2}
              maxLength={3500}
              value={purposeOfVisit}
              onChange={(e) => setPurposeOfVisit(e.target.value)}
              placeholder="State destination unit within Triple C Pigs (Innscor Africa Ltd)..."
              className={`w-full px-3.5 py-2 rounded-xl text-sm border outline-none resize-none transition ${
                isDark
                  ? 'bg-slate-950 border-slate-700 text-white focus:border-emerald-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
              }`}
            />
          </div>
        </div>

        {/* Section 2: Dynamic Form Engine (Baseline Biosecurity Questions) */}
        <div
          className={`rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl border transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className={`text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center justify-between border-b pb-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-amber-500" />
              DECLARATION
            </div>
            <span className="text-[10px] text-slate-400 font-normal">
              {questions.filter((q) => q.type !== 'SIGNATURE').length} active gate checks
            </span>
          </div>

          {questions
            .filter((q) => q.type !== 'SIGNATURE')
            .map((q) => {
              const currentVal = dynamicAnswers[q.id];
              const isBoolean = q.type === 'BOOLEAN';

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
                      ? 'bg-rose-950/40 border-rose-600 text-rose-200'
                      : isDark
                      ? 'bg-slate-950/70 border-slate-800 text-slate-200'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5 max-w-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold leading-snug">
                          {q.prompt}
                        </span>
                        {q.required && <span className="text-rose-500 text-xs">*</span>}
                      </div>
                      {isTriggeringRed && (
                        <div className="text-[11px] text-rose-400 font-medium">
                          ⚠ {q.failureMessage}
                        </div>
                      )}
                    </div>

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
                              : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
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
                              : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          YES
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Section 3: Optional Photo Capture & Legal Signature */}
        <div
          className={`rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl border transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className={`text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center justify-between border-b pb-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex items-center gap-1.5">
              <Camera className="w-4 h-4" />
              Section 3: Optional Photo &amp; Digital Signature
            </div>
            <span className="text-[10px] text-slate-400 font-normal">Photo is optional</span>
          </div>

          {/* Optional Photo Upload/Capture Card */}
          <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-3">
              {capturedPhoto ? (
                <img
                  src={capturedPhoto}
                  alt="Visitor Photo"
                  className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-500 shadow"
                />
              ) : (
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 border-dashed ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
                  <Camera className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="text-xs font-bold">Visitor Photo Snapshot (Optional)</div>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Optional optical identification. Not mandatory for gate check-in.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition border border-slate-700"
              >
                {capturedPhoto ? 'Change Photo' : 'Upload / Capture Photo'}
              </button>
              {capturedPhoto && (
                <button
                  type="button"
                  onClick={() => setCapturedPhoto(null)}
                  className="px-2.5 py-2 text-rose-400 hover:bg-slate-800 rounded-xl text-xs transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Optional Digital Legal Signature */}
          <DigitalSignaturePad
            onSignatureChange={(sig) => setDigitalSignature(sig)}
            required={false}
          />
        </div>

        {/* Primary Evaluate Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base uppercase tracking-wider rounded-2xl shadow-xl shadow-emerald-950/40 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

      {/* Decision Pop-Up Modal (GREEN / RED) */}
      {isModalOpen && decisionResult && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in"
        >
          <div
            className={`w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden transition-all ${
              decisionResult.status === 'GRANTED'
                ? 'bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 border-emerald-500/60 shadow-emerald-950/50'
                : 'bg-gradient-to-b from-rose-950 via-slate-900 to-slate-950 border-rose-500/70 shadow-rose-950/60'
            }`}
          >
            {/* Header Banner */}
            <div
              className={`px-6 py-5 text-center flex flex-col items-center justify-center relative ${
                decisionResult.status === 'GRANTED' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white animate-pulse'
              }`}
            >
              <span className="text-[10px] uppercase tracking-widest font-black opacity-90 mb-1">
                {facilityName}
              </span>
              <div className="flex items-center gap-3 my-1">
                {decisionResult.status === 'GRANTED' ? (
                  <CheckCircle2 className="w-10 h-10 text-white drop-shadow" />
                ) : (
                  <AlertOctagon className="w-10 h-10 text-white drop-shadow" />
                )}
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
                  {decisionResult.status === 'GRANTED' ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                </h2>
              </div>
              <p className="text-xs sm:text-sm font-semibold tracking-wide text-white/95 text-center max-w-md">
                {decisionResult.primaryReason}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 text-slate-100">
              {/* GREEN MODAL PASS */}
              {decisionResult.status === 'GRANTED' && decisionResult.gateBadge && (
                <div className="space-y-4">
                  <div className="bg-slate-900/90 rounded-xl p-4 sm:p-5 border border-emerald-500/30">
                    <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-3">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5" />
                          Authorized Entry Pass
                        </div>
                        <div className="text-xl font-black text-white mt-0.5">
                          {decisionResult.visitorName}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          {decisionResult.idType === 'PASSPORT' ? 'Passport' : 'National ID'}: {decisionResult.idNumber} • {decisionResult.countryOfOrigin}
                        </div>
                      </div>

                      {capturedPhoto ? (
                        <img
                          src={capturedPhoto}
                          alt="Visitor"
                          className="w-14 h-14 rounded-lg object-cover border-2 border-emerald-500 shadow"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-emerald-900/40 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-300">
                          <UserCheck className="w-8 h-8" />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block mb-0.5">Badge Number</span>
                        <span className="font-mono font-bold text-emerald-300 text-sm">
                          {decisionResult.gateBadge.badgeNumber}
                        </span>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block mb-0.5">Validity</span>
                        <span className="font-semibold text-slate-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          8 Hours (Single Entry)
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-lg flex items-center justify-between text-slate-900">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-7 h-7 text-emerald-950" />
                        <span className="text-xs font-black uppercase">CLEARANCE TOKEN ACTIVE</span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded">
                        POSTGRES: CHECKED_IN
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print Gate Badge
                  </button>
                </div>
              )}

              {/* RED MODAL REFUSAL */}
              {decisionResult.status === 'DENIED' && (
                <div className="space-y-4">
                  <div className="bg-rose-950/60 rounded-xl p-4 sm:p-5 border border-rose-500/40 text-rose-100 space-y-3">
                    <div className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                      Quarantine Protocol Violations:
                    </div>

                    <div className="space-y-2">
                      {decisionResult.denialReasons.map((reason, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950/80 p-3 rounded-lg border border-rose-900 text-xs flex items-start gap-2"
                        >
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-mono font-bold text-rose-300 text-[11px]">
                              [{reason.code}]
                            </div>
                            <div className="text-slate-200 mt-0.5">{reason.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {decisionResult.emailAlertDispatched && (
                      <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          Automated email alert dispatched to configured security recipients via Nodemailer.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reset Button */}
              <button
                type="button"
                onClick={handleResetForm}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Scanner for Next Vehicle / Visitor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
