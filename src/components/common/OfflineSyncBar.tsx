/**
 * Offline Sync Banner & Batch Processor
 * Synchronizes queued field handheld submissions when reconnected to network
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, CloudUpload, WifiOff } from 'lucide-react';
import { getOfflineQueue, clearOfflineQueue, QueuedSubmission } from '../../lib/offline-storage';

interface OfflineSyncBarProps {
  onSyncComplete?: () => void;
}

export const OfflineSyncBar: React.FC<OfflineSyncBarProps> = ({ onSyncComplete }) => {
  const [queuedItems, setQueuedItems] = useState<QueuedSubmission[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const checkQueue = () => {
    setQueuedItems(getOfflineQueue());
  };

  useEffect(() => {
    checkQueue();
    const interval = setInterval(checkQueue, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncAll = async () => {
    if (queuedItems.length === 0) return;
    setIsSyncing(true);
    setSyncSuccessMsg(null);

    try {
      const payloadBatch = queuedItems.map((q) => q.payload);
      const res = await fetch('/api/sync/offline-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadBatch }),
      });

      if (res.ok) {
        const count = queuedItems.length;
        clearOfflineQueue();
        setQueuedItems([]);
        setSyncSuccessMsg(`Successfully synchronized ${count} offline gate logs to PostgreSQL database!`);
        setTimeout(() => setSyncSuccessMsg(null), 4000);
        if (onSyncComplete) onSyncComplete();
      }
    } catch (err) {
      console.error('Failed to sync offline items', err);
    } finally {
      setIsSyncing(false);
    }
  };

  if (queuedItems.length === 0 && !syncSuccessMsg) return null;

  return (
    <div className="w-full bg-amber-950/90 border border-amber-600/70 text-amber-200 px-4 py-2.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 shadow-lg animate-in slide-in-from-top">
      {syncSuccessMsg ? (
        <div className="flex items-center gap-2 text-emerald-300 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {syncSuccessMsg}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-400" />
          <span>
            <strong className="text-white font-mono">{queuedItems.length}</strong> offline gate submission(s) stored locally in handheld memory.
          </span>
        </div>
      )}

      {queuedItems.length > 0 && (
        <button
          type="button"
          onClick={handleSyncAll}
          disabled={isSyncing}
          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition flex items-center gap-1.5 shadow"
        >
          {isSyncing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Syncing to PostgreSQL...
            </>
          ) : (
            <>
              <CloudUpload className="w-3.5 h-3.5" />
              Sync Batch to Server
            </>
          )}
        </button>
      )}
    </div>
  );
};
