/**
 * Offline Synchronization Engine for Field Gate Handheld Scanners
 * Stores pending submissions, caches offline visitor registry, and flushes upon reconnection.
 */

import { GateEntryPayload, RegisteredVisitor } from '../types';

const OFFLINE_QUEUE_KEY = 'colcom_gate_offline_queue_v1';
const OFFLINE_CACHE_KEY = 'colcom_cached_visitors_v1';

export interface QueuedSubmission {
  id: string;
  payload: GateEntryPayload;
  queuedAt: string;
  retryCount: number;
}

export function getOfflineQueue(): QueuedSubmission[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read offline queue from storage', err);
    return [];
  }
}

export function queueOfflineSubmission(payload: GateEntryPayload): QueuedSubmission {
  const queue = getOfflineQueue();
  const queuedItem: QueuedSubmission = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    payload: {
      ...payload,
      isOfflineSubmission: true,
      timestamp: new Date().toISOString(),
    },
    queuedAt: new Date().toISOString(),
    retryCount: 0,
  };

  queue.push(queuedItem);
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to write to offline queue', err);
  }
  return queuedItem;
}

export function removeFromOfflineQueue(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to update offline queue', err);
  }
}

export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (err) {
    console.error('Failed to clear offline queue', err);
  }
}

/**
 * Offline visitor registry cache for field handheld lookup
 */
export function cacheOfflineVisitors(visitors: RegisteredVisitor[]): void {
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(visitors));
  } catch (err) {
    console.error('Failed to cache visitors for offline use', err);
  }
}

export function getCachedOfflineVisitors(): RegisteredVisitor[] {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}
