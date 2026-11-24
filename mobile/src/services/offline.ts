import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Offline support shared by the web and Android builds.
 *
 * - `readCache` / `writeCache` keep the last successful response for every
 *   GET endpoint so dashboards, guidelines and patient lists stay usable
 *   without a connection.
 * - `enqueueMutation` records writes made while offline and replays them when
 *   the device reconnects (see `flushPendingMutations` in services/api.ts).
 * - A tiny observable store drives the offline banner and queue counter.
 */

const CACHE_PREFIX = "steward:cache:v1:";
const QUEUE_KEY = "steward:queue:v1";

export interface OfflineState {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
}

export interface CachedValue<T> {
  data: T;
  savedAt: number;
}

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: string;
  body: unknown;
  kind: string;
  tempId?: number;
  ts: number;
}

type Listener = (state: OfflineState) => void;

let state: OfflineState = {
  online: true,
  pending: 0,
  syncing: false,
  lastSyncAt: null,
  lastError: null,
};

const listeners = new Set<Listener>();
const syncedListeners = new Set<() => void>();

export function getOfflineState(): OfflineState {
  return state;
}

export function subscribeOffline(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

function setState(patch: Partial<OfflineState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
}

/** Used by the sync routine in services/api.ts. */
export function updateOfflineState(patch: Partial<OfflineState>) {
  setState(patch);
}

export function markOnline() {
  if (!state.online) setState({ online: true, lastError: null });
}

export function markOffline() {
  if (state.online) setState({ online: false });
}

export function onOfflineSynced(listener: () => void): () => void {
  syncedListeners.add(listener);
  return () => syncedListeners.delete(listener);
}

export function emitOfflineSynced() {
  syncedListeners.forEach((listener) => listener());
}

/* ------------------------------------------------------------------ */
/* Response cache                                                      */
/* ------------------------------------------------------------------ */

export function cacheKey(endpoint: string): string {
  return `get:${endpoint}`;
}

export function mutationCacheKey(endpoint: string, body: string): string {
  return `post:${endpoint}:${body}`;
}

export async function readCache<T>(key: string): Promise<CachedValue<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedValue<T>;
    if (!parsed || typeof parsed !== "object" || !("data" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, savedAt: Date.now() } satisfies CachedValue<T>)
    );
  } catch {
    // A full device cache should never break a successful request.
  }
}

export async function removeCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/* Mutation queue                                                      */
/* ------------------------------------------------------------------ */

export async function readQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
  setState({ pending: queue.length });
}

export async function refreshPendingCount(): Promise<number> {
  const queue = await readQueue();
  setState({ pending: queue.length });
  return queue.length;
}

export async function enqueueMutation(
  entry: Omit<QueuedMutation, "id" | "ts">
): Promise<QueuedMutation> {
  const queue = await readQueue();
  const queued: QueuedMutation = {
    ...entry,
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
  };
  queue.push(queued);
  await writeQueue(queue);
  return queued;
}

export async function removeQueuedMutation(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((entry) => entry.id !== id));
}

/* ------------------------------------------------------------------ */
/* Browser connectivity                                                */
/* ------------------------------------------------------------------ */

export function initOfflineDetection(): () => void {
  if (Platform.OS !== "web" || typeof window === "undefined") return () => {};

  const goOnline = () => markOnline();
  const goOffline = () => markOffline();

  window.addEventListener("online", goOnline);
  window.addEventListener("offline", goOffline);
  if (typeof navigator !== "undefined" && navigator.onLine === false) markOffline();

  return () => {
    window.removeEventListener("online", goOnline);
    window.removeEventListener("offline", goOffline);
  };
}
