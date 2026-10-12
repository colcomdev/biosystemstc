/**
 * Dynamic Form & Question Builder UI
 * Allows Security Managers & Biosecurity Officers to configure entry questions
 */

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MoveUp,
  MoveDown,
  Layers,
  Sparkles,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { DynamicFormQuestion, QuestionType, RedAlertTrigger } from '../../types';
import { apiUrl } from '../../lib/api';

interface DynamicQuestionBuilderProps {
  questions: DynamicFormQuestion[];
  onRefresh: () => void;
}

export const DynamicQuestionBuilder: React.FC<DynamicQuestionBuilderProps> = ({
  questions,
  onRefresh,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState<QuestionType>('BOOLEAN');
  const [required, setRequired] = useState(true);
  const [triggerRedAlertOn, setTriggerRedAlertOn] = useState<RedAlertTrigger>('TRUE');
  const [failureMessage, setFailureMessage] = useState('');
  const [category, setCategory] = useState<'BIOSECURITY' | 'IDENTITY' | 'SAFETY' | 'GENERAL'>('BIOSECURITY');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleResetDefaults = async () => {
    if (!confirm('Restore baseline Triple C Pigs biosecurity declaration questions?')) return;
    setIsResetting(true);
    try {
      const res = await fetch(apiUrl('/api/form-questions/reset-defaults'), {
        method: 'POST',
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to reset default questions', err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleActive = async (q: DynamicFormQuestion) => {
    try {
      const res = await fetch(apiUrl(`/api/form-questions/${q.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !q.isActive }),
      });
      if (res.ok) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (q: DynamicFormQuestion) => {
    if (q.isBaseline) {
      alert('Baseline Triple C Pigs biosecurity rules cannot be deleted. You may deactivate them.');
      return;
    }
    if (!confirm(`Delete question: "${q.prompt}"?`)) return;

    try {
      const res = await fetch(apiUrl(`/api/form-questions/${q.id}`), { method: 'DELETE' });
      if (res.ok) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setErrorMsg('Question prompt is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(apiUrl('/api/form-questions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          type,
          required,
          triggerRedAlertOn,
          failureMessage:
            failureMessage.trim() ||
            `Biosecurity criteria violated for question: "${prompt}"`,
          category,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create question');
      }

      setIsCreating(false);
      setPrompt('');
      setFailureMessage('');
      onRefresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error creating question');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveOrder = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const newOrder = [...questions];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    const orderedIds = newOrder.map((q) => q.id);

    try {
      const res = await fetch(apiUrl('/api/form-questions/reorder'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
      if (res.ok) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Dynamic Form Engine &amp; Question Builder
          </h3>
          <p className="text-xs text-slate-400">
            Configure gate entry declarations rendered on mobile scanners. Changes update live in PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isResetting}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 border border-slate-700"
            title="Restore baseline Triple C Pigs biosecurity questions"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isResetting ? 'animate-spin' : ''}`} />
            {isResetting ? 'Restoring...' : 'Restore Defaults'}
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow"
          >
            <Plus className="w-4 h-4" />
            {isCreating ? 'Cancel' : 'Add Dynamic Question'}
          </button>
        </div>
      </div>

      {/* Question Creation Form */}
      {isCreating && (
        <form
          onSubmit={handleCreateQuestion}
          className="bg-slate-950 border border-slate-700/80 rounded-xl p-4 space-y-3 animate-in fade-in text-xs"
        >
          <div className="font-bold text-white text-xs flex items-center gap-1.5 text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" /> New Biosecurity Check Specification
          </div>

          {errorMsg && (
            <div className="p-2 bg-rose-950 text-rose-300 rounded border border-rose-800">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Question Prompt / Declaration Text *
            </label>
            <input
              type="text"
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Have you visited any pig abattoir within the last 14 days?"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as QuestionType)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-emerald-500"
              >
                <option value="BOOLEAN">Yes / No (Boolean)</option>
                <option value="TEXT">Short Text Field</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Trigger RED Alert On
              </label>
              <select
                value={triggerRedAlertOn}
                onChange={(e) => setTriggerRedAlertOn(e.target.value as RedAlertTrigger)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-emerald-500"
              >
                <option value="TRUE">When Answer = YES</option>
                <option value="FALSE">When Answer = NO</option>
                <option value="NONE">None (Informational)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-emerald-500"
              >
                <option value="BIOSECURITY">Biosecurity</option>
                <option value="IDENTITY">Identity / Verification</option>
                <option value="SAFETY">Occupational Safety</option>
                <option value="GENERAL">General</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Failure Message (Displayed when RED alert is triggered)
            </label>
            <input
              type="text"
              value={failureMessage}
              onChange={(e) => setFailureMessage(e.target.value)}
              placeholder="e.g. Exposure to commercial abattoir triggers mandatory 7-day quarantine."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500"
              />
              Required Question (Cannot be skipped by gate operator)
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition"
            >
              {isSubmitting ? 'Saving to Database...' : 'Save Question'}
            </button>
          </div>
        </form>
      )}

      {/* Dynamic Questions Table / Cards */}
      <div className="space-y-2.5">
        {questions.length === 0 && (
          <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 space-y-3">
            <HelpCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-xs text-slate-300 font-medium">No declaration questions currently loaded.</p>
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={isResetting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              Restore Default Biosecurity Questions
            </button>
          </div>
        )}
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              q.isActive
                ? 'bg-slate-950 border-slate-800'
                : 'bg-slate-950/40 border-slate-900 opacity-60'
            }`}
          >
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  #{q.order}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">
                  {q.type}
                </span>
                {q.isBaseline && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                    BASELINE RULE
                  </span>
                )}
                {q.triggerRedAlertOn !== 'NONE' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    Triggers RED on {q.triggerRedAlertOn}
                  </span>
                )}
                {q.required && (
                  <span className="text-[10px] text-slate-400">Required</span>
                )}
              </div>

              <div className="text-xs font-bold text-white leading-snug">
                {q.prompt}
              </div>

              <div className="text-[11px] text-slate-400">
                Failure alert: <span className="text-slate-300 italic">{q.failureMessage}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {/* Order Controls */}
              <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded border border-slate-800">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMoveOrder(idx, 'UP')}
                  className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                  title="Move Up"
                >
                  <MoveUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === questions.length - 1}
                  onClick={() => handleMoveOrder(idx, 'DOWN')}
                  className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                  title="Move Down"
                >
                  <MoveDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Active Toggle */}
              <button
                type="button"
                onClick={() => handleToggleActive(q)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                  q.isActive
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {q.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {q.isActive ? 'Active' : 'Inactive'}
              </button>

              {/* Delete Button */}
              {!q.isBaseline && (
                <button
                  type="button"
                  onClick={() => handleDelete(q)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                  title="Delete Question"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
