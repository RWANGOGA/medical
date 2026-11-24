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
const SCOPE_KEY = "steward:scope:v1";

/**
 * Signed-in user id that owns the cache and queue. Keys are namespaced by it so
 * a second user on the same device can never read the previous user's patient
 * data, even offline. `null` means "signed out".
 */
let cacheScope: string | null = null;

export function getCacheScope(): string | null {
  return cacheScope;
}

/** Restore the scope saved by the last session. Call once at startup. */
export async function initCacheScope(): Promise<string | null> {
  try {
    cacheScope = await AsyncStorage.getItem(SCOPE_KEY);
  } catch {
    cacheScope = null;
  }
  return cacheScope;
}

/**
 * Point the cache at a user. When the user changes, everything cached for the
 * previous user is removed before the new scope becomes active.
 */
export async function setCacheScope(userId: number | string | null): Promise<void> {
  const next = userId == null ? null : String(userId);
  if (next === cacheScope) return;
  await clearOfflineData();
  cacheScope = next;
  try {
    if (next) await AsyncStorage.setItem(SCOPE_KEY, next);
    else await AsyncStorage.removeItem(SCOPE_KEY);
  } catch {
    // ignore storage failures
  }
  await refreshPendingCount();
}

/** Remove every cached response and queued write on this device. */
export async function clearOfflineData(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(
      (key) => key.startsWith(CACHE_PREFIX) || key.startsWith(QUEUE_KEY)
    );
    if (ours.length) await (AsyncStorage as any).multiRemove(ours);
  } catch {
    // ignore
  }
  setState({ pending: 0 });
}

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
  return `get:${cacheScope ?? "guest"}:${endpoint}`;
}

export function mutationCacheKey(endpoint: string, body: string): string {
  return `post:${cacheScope ?? "guest"}:${endpoint}:${body}`;
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

function queueStorageKey(): string {
  return `${QUEUE_KEY}:${cacheScope ?? "guest"}`;
}

export async function readQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(queueStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(queueStorageKey(), JSON.stringify(queue));
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
