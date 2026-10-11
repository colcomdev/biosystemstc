/**
 * Pre-Register Visitor Modal (Biometric Enrollment)
 * Allows Security Managers and Biosecurity Officers to enroll visitors and generate 512-dim embeddings.
 */

import React, { useState } from 'react';
import { UserPlus, X, Check, Scan, Building, Phone, CreditCard, Globe2 } from 'lucide-react';
import { IdentificationType, RegisteredVisitor } from '../../types';
import { apiUrl } from '../../lib/api';

interface PreRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVisitorAdded: (visitor: RegisteredVisitor) => void;
}

export const PreRegisterModal: React.FC<PreRegisterModalProps> = ({
  isOpen,
  onClose,
  onVisitorAdded,
}) => {
  const [fullName, setFullName] = useState('');
  const [idType, setIdType] = useState<IdentificationType>('NATIONAL_ID');
  const [idNumber, setIdNumber] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('Zimbabwe');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState<'CONTRACTOR' | 'SUPPLIER' | 'VET_INSPECTOR' | 'OFFICIAL_AUDITOR' | 'CUSTOMER'>('CONTRACTOR');
  const [photoUrl, setPhotoUrl] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    if (!fullName.trim() || !idNumber.trim() || cleanPhone.length < 10) {
      setError('Please provide valid full name, ID / Passport number, and minimum 10-digit phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/visitors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          idType,
          idNumber,
          countryOfOrigin,
          phoneNumber: cleanPhone,
          company,
          category,
          photoUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to register visitor');
      }

      const created = await res.json();
      onVisitorAdded(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Enroll Authorized Visitor</h2>
              <p className="text-xs text-slate-400">
                Triple C Pigs Pre-Approval &amp; 512D Vector Enrollment
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-slate-200">
          {error && (
            <div className="bg-rose-950/70 border border-rose-600/80 rounded-xl p-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Full Legal Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Farai Matthews"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  ID Document Type *
                </label>
                <div className="flex items-center bg-slate-950 rounded p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIdType('NATIONAL_ID')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      idType === 'NATIONAL_ID' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdType('PASSPORT')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      idType === 'PASSPORT' ? 'bg-emerald-600 text-white' : 'text-slate-400'
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
                  placeholder={idType === 'NATIONAL_ID' ? '63-289471-K-42' : 'E92049182'}
                  className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono uppercase focus:border-emerald-500 outline-none"
                />
                <CreditCard className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Country of Origin *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={countryOfOrigin}
                  onChange={(e) => setCountryOfOrigin(e.target.value)}
                  placeholder="Zimbabwe"
                  className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-emerald-500 outline-none"
                />
                <Globe2 className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phone Number (Digits) *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="263773466252"
                  className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:border-emerald-500 outline-none"
                />
                <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Company / Organization
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. AgriCold Ref."
                  className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-emerald-500 outline-none"
                />
                <Building className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-emerald-500 outline-none"
            >
              <option value="CONTRACTOR">Contractor</option>
              <option value="SUPPLIER">Feed / Logistics Supplier</option>
              <option value="VET_INSPECTOR">Vet Health Inspector</option>
              <option value="OFFICIAL_AUDITOR">Group Auditor</option>
              <option value="CUSTOMER">Wholesale Customer</option>
            </select>
          </div>

          {/* Biometric Avatar Preview & Synthetic 512D Vector note */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center gap-3">
            <img
              src={photoUrl}
              alt="Biometric Baseline"
              className="w-12 h-12 rounded-lg object-cover border border-emerald-500/60"
            />
            <div className="text-xs">
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <Scan className="w-3.5 h-3.5" />
                512-D Biometric Embedding
              </span>
              <p className="text-[11px] text-slate-400">
                Vector will be generated and indexed in PostgreSQL via pgvector cosine distance.
              </p>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              <Check className="w-4 h-4" />
              Enroll &amp; Authorize
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
