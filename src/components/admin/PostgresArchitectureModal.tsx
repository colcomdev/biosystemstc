/**
 * PostgreSQL Database Architecture & pgvector Schema Modal
 * Displays SQL DDL, Prisma Schema, Cosine Indexing Strategy, and ERD specs
 */

import React, { useState } from 'react';
import { Database, Copy, Check, X, Code2, Layers, Cpu, Download } from 'lucide-react';
import { POSTGRES_SQL_SCHEMA, PRISMA_SCHEMA } from '../../lib/db-schema-definitions';

interface PostgresArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PostgresArchitectureModal: React.FC<PostgresArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'sql' | 'prisma' | 'vector_specs'>('sql');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const contentToCopy = activeTab === 'sql' ? POSTGRES_SQL_SCHEMA : PRISMA_SCHEMA;

  const handleCopy = () => {
    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = activeTab === 'sql' ? 'colcom_biosecurity_schema.sql' : 'schema.prisma';
    const blob = new Blob([contentToCopy], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in"
    >
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                PostgreSQL Architecture &amp; pgvector Specification
              </h2>
              <p className="text-xs text-slate-400">
                Triple C Pigs Schema • Vector Cosine Indexing • Audit Logs
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

        {/* Tab Selector & Actions */}
        <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('sql')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'sql'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              SQL DDL (PostgreSQL 16+)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('prisma')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'prisma'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Prisma ORM Schema
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('vector_specs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'vector_specs'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              pgvector 512D Pipeline
            </button>
          </div>

          {activeTab !== 'vector_specs' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Code
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                Export File
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto font-mono text-xs text-slate-300 flex-1 bg-slate-950">
          {activeTab === 'sql' && (
            <pre className="whitespace-pre-wrap leading-relaxed text-blue-200/90 select-all">
              {POSTGRES_SQL_SCHEMA}
            </pre>
          )}

          {activeTab === 'prisma' && (
            <pre className="whitespace-pre-wrap leading-relaxed text-emerald-200/90 select-all">
              {PRISMA_SCHEMA}
            </pre>
          )}

          {activeTab === 'vector_specs' && (
            <div className="space-y-4 font-sans text-xs text-slate-300">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <h3 className="text-sm font-bold text-white mb-1.5 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Facial Biometric Vector Embeddings Architecture
                </h3>
                <p className="text-slate-400 leading-relaxed mb-3">
                  Each enrolled visitor at Triple C Pigs has a normalized 512-dimensional vector stored
                  in PostgreSQL via the official <code className="text-emerald-300 font-mono">pgvector</code> extension.
                  When a visitor presents at Gate 01, the mobile scanner captures their facial geometry,
                  extracts the 512-D tensor, and executes an index-accelerated cosine distance query:
                </p>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400">
                  {`SELECT id, full_name, 1 - (biometric_embedding <=> $1::vector) AS similarity_score
FROM registered_visitors
WHERE phone_number = $2
ORDER BY biometric_embedding <=> $1::vector ASC
LIMIT 1;`}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
                <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                  <span className="font-bold text-white block mb-1">Threshold Validation:</span>
                  <p className="text-slate-400 text-xs">
                    Access is granted strictly if <code className="text-emerald-300 font-mono">similarity_score &gt; 0.85</code> (85% similarity). Below 0.85 triggers rule <code className="text-rose-400 font-mono">BIOMETRIC_SIMILARITY_BELOW_THRESHOLD</code>.
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                  <span className="font-bold text-white block mb-1">HNSW Index Performance:</span>
                  <p className="text-slate-400 text-xs">
                    Sub-millisecond approximate nearest neighbor lookup using Hierarchical Navigable Small World graphs with parameters <code className="text-emerald-300 font-mono">m = 16, ef_construction = 64</code>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
