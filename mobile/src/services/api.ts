import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  QueuedMutation,
  cacheKey,
  emitOfflineSynced,
  enqueueMutation,
  getOfflineState,
  markOffline,
  markOnline,
  mutationCacheKey,
  readCache,
  readQueue,
  removeQueuedMutation,
  updateOfflineState,
  writeCache,
} from "./offline";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8002/api/v1";

let authToken: string | null = null;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const setAuthToken = async (token: string | null) => {
  authToken = token;
  if (token) {
    await AsyncStorage.setItem("authToken", token);
  } else {
    await AsyncStorage.removeItem("authToken");
  }
};

export const getStoredToken = async (): Promise<string | null> => {
  if (authToken) return authToken;
  const token = await AsyncStorage.getItem("authToken");
  if (token) authToken = token;
  return token;
};

/* ------------------------------------------------------------------ */
/* Offline-aware request layer                                         */
/* ------------------------------------------------------------------ */

const REQUEST_TIMEOUT_MS = 15000;

/** POST responses worth keeping so CDS/guidance still opens offline. */
const CACHEABLE_POSTS = [
  "/cds/recommend",
  "/antibiotics/summarize",
  "/guidelines/expand",
  "/search/patients",
  "/assistant/chat",
  "/translate/",
];

/** Writes that are safe to queue locally and replay when back online. */
const QUEUEABLE_MUTATIONS: { pattern: RegExp; method: string; kind: string }[] = [
  { pattern: /^\/patients\/$/, method: "POST", kind: "patient-create" },
  { pattern: /^\/patients\/\d+$/, method: "PUT", kind: "patient-update" },
  { pattern: /^\/lab\/results$/, method: "POST", kind: "lab-create" },
  { pattern: /^\/amc\/use$/, method: "POST", kind: "amc-use" },
  { pattern: /^\/amc\/activity$/, method: "POST", kind: "amc-activity" },
];

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function throwIfNotOk(response: Response): Promise<void> {
  if (response.ok) return;
  const errorData = await response.json().catch(() => ({}));
  throw new ApiError(
    (errorData as { detail?: string }).detail || `API Error: ${response.status}`,
    response.status
  );
}

function optimisticRecord(kind: string, body: any, endpoint: string, tempId: number) {
  const now = new Date().toISOString();
  if (kind === "patient-update") {
    return { ...body, id: Number(endpoint.split("/").pop()), __offline: true };
  }
  return { ...body, id: tempId, created_at: now, __offline: true };
}

async function applyOptimisticCache(kind: string, endpoint: string, record: any) {
  if (kind === "patient-create") {
    const cached = await readCache<any[]>(cacheKey("/patients/"));
    const list = Array.isArray(cached?.data) ? cached.data : [];
    await writeCache(cacheKey("/patients/"), [record, ...list.filter((p) => p.id !== record.id)]);
    return;
  }
  if (kind === "patient-update") {
    const cached = await readCache<any[]>(cacheKey("/patients/"));
    if (Array.isArray(cached?.data)) {
      const id = Number(endpoint.split("/").pop());
      await writeCache(
        cacheKey("/patients/"),
        cached.data.map((p: any) => (p.id === id ? { ...p, ...record } : p))
      );
    }
    return;
  }
  if (kind === "lab-create") {
    const cached = await readCache<any[]>(cacheKey("/lab/results"));
    const list = Array.isArray(cached?.data) ? cached.data : [];
    await writeCache(cacheKey("/lab/results"), [record, ...list]);
  }
}

async function handleOfflineMutation<T>(
  endpoint: string,
  method: string,
  bodyText?: string
): Promise<T> {
  let body: unknown;
  try {
    body = bodyText ? JSON.parse(bodyText) : undefined;
  } catch {
    body = undefined;
  }

  const rule = QUEUEABLE_MUTATIONS.find(
    (candidate) => candidate.method === method && candidate.pattern.test(endpoint)
  );

  if (rule) {
    const tempId = -Date.now();
    const record = optimisticRecord(rule.kind, body, endpoint, tempId);
    await applyOptimisticCache(rule.kind, endpoint, record);
    await enqueueMutation({ endpoint, method, body, kind: rule.kind, tempId });
    return record as T;
  }

  if (bodyText) {
    const cached = await readCache<T>(mutationCacheKey(endpoint, bodyText));
    if (cached) return cached.data;
  }

  throw new ApiError(
    "You are offline. This action needs a connection — your saved data is still available.",
    0
  );
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const bodyText = typeof options?.body === "string" ? options.body : undefined;

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // ALWAYS ensure we have the latest token (memory first, then storage)
  if (!authToken) {
    authToken = await AsyncStorage.getItem("authToken");
  }
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  if (method === "GET") {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
        ...options,
        method,
        headers,
      });
      markOnline();
      await throwIfNotOk(response);
      const data = (await response.json()) as T;
      await writeCache(cacheKey(endpoint), data);
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      markOffline();
      const cached = await readCache<T>(cacheKey(endpoint));
      if (cached) return cached.data;
      throw new ApiError(
        "You are offline and this page has not been saved yet. Connect once to make it available offline.",
        0
      );
    }
  }

  if (!getOfflineState().online) {
    return handleOfflineMutation<T>(endpoint, method, bodyText);
  }

  try {
    const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
      ...options,
      method,
      headers,
    });
    markOnline();
    await throwIfNotOk(response);
    const data = (await response.json()) as T;
    if (bodyText && CACHEABLE_POSTS.some((prefix) => endpoint.startsWith(prefix))) {
      await writeCache(mutationCacheKey(endpoint, bodyText), data);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    markOffline();
    return handleOfflineMutation<T>(endpoint, method, bodyText);
  }
}

async function replaceOptimistic(entry: QueuedMutation, serverRecord: any) {
  if (!serverRecord || entry.tempId === undefined) return;
  if (entry.kind === "patient-create") {
    const cached = await readCache<any[]>(cacheKey("/patients/"));
    if (Array.isArray(cached?.data)) {
      await writeCache(
        cacheKey("/patients/"),
        cached.data.map((p: any) => (p.id === entry.tempId ? serverRecord : p))
      );
    }
    return;
  }
  if (entry.kind === "lab-create") {
    const cached = await readCache<any[]>(cacheKey("/lab/results"));
    if (Array.isArray(cached?.data)) {
      await writeCache(
        cacheKey("/lab/results"),
        cached.data.map((l: any) => (l.id === entry.tempId ? serverRecord : l))
      );
    }
  }
}

/**
 * Replay writes queued while offline. Safe to call on app start, on the
 * browser `online` event and from the "Sync now" button.
 */
export async function flushPendingMutations(): Promise<{ synced: number; failed: number }> {
  const queue = await readQueue();
  if (queue.length === 0) {
    updateOfflineState({ pending: 0 });
    return { synced: 0, failed: 0 };
  }
  if (getOfflineState().syncing) return { synced: 0, failed: 0 };

  updateOfflineState({ syncing: true });

  const token = authToken || (await AsyncStorage.getItem("authToken"));
  let synced = 0;
  let failed = 0;
  let stopped = false;

  for (const entry of queue) {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}${entry.endpoint}`, {
        method: entry.method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: entry.body !== undefined ? JSON.stringify(entry.body) : undefined,
      });

      if (!response.ok) {
        // Permanent rejections should not block the queue forever.
        if ([400, 403, 404, 409, 422].includes(response.status)) {
          failed += 1;
          await removeQueuedMutation(entry.id);
          continue;
        }
        // Auth/rate-limit/server errors: keep the entry for a later retry.
        stopped = true;
        break;
      }

      const data = await response.json().catch(() => null);
      await replaceOptimistic(entry, data);
      await removeQueuedMutation(entry.id);
      synced += 1;
    } catch {
      stopped = true;
      break;
    }
  }

  const remaining = await readQueue();
  updateOfflineState({
    syncing: false,
    pending: remaining.length,
    lastSyncAt: synced > 0 ? Date.now() : getOfflineState().lastSyncAt,
    online: !stopped,
  });
  if (synced > 0) emitOfflineSynced();

  return { synced, failed };
}

export const api = {
  // Core Data
  getOrganisms: () => request<any[]>("/organisms/"),
  getAntibiotics: () => request<any[]>("/antibiotics/"),
  getPatients: () => request<any[]>("/patients/"),
  getPatientById: (id: string | number) => request<any>(`/patients/${id}`),
  createPatient: (payload: any) =>
    request<any>("/patients/", { method: "POST", body: JSON.stringify(payload) }),
  updatePatient: (id: string | number, payload: any) =>
    request<any>(`/patients/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  
  // Duplicate check
  checkDuplicate: (payload: any) =>
    request<any>("/patients/check-duplicate", { method: "POST", body: JSON.stringify(payload) }),

  // CDS
  getCDSRecommendation: (payload: any) =>
    request<any>("/cds/recommend", { method: "POST", body: JSON.stringify(payload) }),

    // Surveillance Dashboard (optional hospital filter)
  getHospitals: (filterByDoctor = false) => {
    const query = filterByDoctor ? "?filter_by_doctor=true" : "";
    return request<string[]>(`/dashboard/hospitals${query}`);
  },
  getDoctorHospital: () => request<{ hospital: string }>("/dashboard/doctor-hospital"),
  getDashboardTrends: (hospital?: string) =>
    request<any[]>(`/dashboard/trends${hospital ? `?hospital=${encodeURIComponent(hospital)}` : ""}`),
  getDashboardAntibiogram: (hospital?: string) =>
    request<any>(`/dashboard/antibiogram${hospital ? `?hospital=${encodeURIComponent(hospital)}` : ""}`),
  getDashboardAware: (hospital?: string) =>
    request<any[]>(`/dashboard/aware${hospital ? `?hospital=${encodeURIComponent(hospital)}` : ""}`),
  getDashboardAlerts: (hospital?: string) =>
    request<string[]>(`/dashboard/alerts${hospital ? `?hospital=${encodeURIComponent(hospital)}` : ""}`),

  // Feature 4: Audit log
  getAuditLogs: (limit = 100) => request<any[]>(`/audit/?limit=${limit}`),

  // Feature 5: Report export (public endpoint)
  reportUrl: (hospital?: string) =>
    `${BASE_URL}/reports/monthly${hospital ? `?hospital=${encodeURIComponent(hospital)}` : ""}`,
  // AI Assistant
  sendAssistantMessage: (messages: any) =>
    request<{ reply: string }>("/assistant/chat", { method: "POST", body: JSON.stringify({ messages }) }),

  // Auth
  login: (username: string, password: string) =>
    request<any>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  register: (data: any) =>
    request<any>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  getMe: () => request<any>("/auth/me"),

  // Smart Patient Search
  searchPatients: (query: string) =>
    request<any>("/search/patients", { method: "POST", body: JSON.stringify({ query }) }),

  // Public endpoints (no auth)
  getOrganismsPublic: () => request<any[]>("/dashboard/organisms-public"),
  getAntibioticsPublic: () => request<any[]>("/dashboard/antibiotics-public"),
  getSurveillanceQuality: (hospital?: string) =>
    request<any>(`/dashboard/surveillance-quality${hospital ? `?hospital=${encodeURIComponent(hospital)}` : ""}`),
  getAntibiogramStratified: (hospital?: string) =>
    request<any>(`/dashboard/antibiogram-stratified${hospital ? `?hospital=${encodeURIComponent(hospital)}` : ""}`),

  // Antimicrobial consumption (WHO GLASS-AMC)
  getAmcSummary: (hospital?: string, fromMonth?: string, toMonth?: string) => {
    const params = [
      hospital ? `hospital=${encodeURIComponent(hospital)}` : "",
      fromMonth ? `from_month=${encodeURIComponent(fromMonth)}` : "",
      toMonth ? `to_month=${encodeURIComponent(toMonth)}` : "",
    ].filter(Boolean).join("&");
    return request<any>(`/amc/summary${params ? `?${params}` : ""}`);
  },
  getAmcUse: (limit = 50) => request<any[]>(`/amc/use?limit=${limit}`),
  getAmcActivity: () => request<any[]>("/amc/activity"),
  recordAmcUse: (payload: any) =>
    request<any>("/amc/use", { method: "POST", body: JSON.stringify(payload) }),
  recordAmcActivity: (payload: any) =>
    request<any>("/amc/activity", { method: "POST", body: JSON.stringify(payload) }),
  getGuidelinesPublic: () => request<any[]>("/dashboard/guidelines-public"),
  getMechanisms: () => request<any>("/dashboard/mechanisms"),

  // Laboratory
  getLabResults: () => request<any[]>("/lab/results"),
  getRecentLabResults: (limit = 10) => request<any[]>(`/lab/recent-results?limit=${limit}`),
  addLabResult: (payload: any) =>
    request<any>("/lab/results", { method: "POST", body: JSON.stringify(payload) }),

  // Chat
  getChatMessages: () => request<any[]>("/chat/messages"),

  // Guideline AI expansion
  expandGuideline: (payload: {
    id: string;
    title: string;
    summary: string;
    source: string;
    year: number;
  }) =>
    request<any>("/guidelines/expand", { method: "POST", body: JSON.stringify(payload) }),

  // Fast AI antibiotic summary
  summarizeAntibiotic: (id: string) =>
    request<any>("/antibiotics/summarize", { method: "POST", body: JSON.stringify({ id }) }),

    translate: (payload: { text: string; target_language: string }) =>
    request<{ translated: string }>("/translate/", { method: "POST", body: JSON.stringify(payload) }),


getAntibiogramStats: (hospital?: string) =>
  request<any>(`/dashboard/antibiogram-stats${hospital ? `?hospital=${encodeURIComponent(hospital)}` : ""}`),

  // Admin endpoints
  getAdminDashboard: () => request<any>("/admin/dashboard"),
  getAdminDoctors: (page = 1, limit = 20) =>
    request<any>(`/admin/doctors?page=${page}&limit=${limit}`),
  suspendDoctor: (doctorId: number, reason: string) =>
    request<any>(`/admin/doctors/${doctorId}/suspend`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    }),
  activateDoctor: (doctorId: number) =>
    request<any>(`/admin/doctors/${doctorId}/activate`, { method: "PUT" }),
  deleteAdminDoctor: (doctorId: number) =>
    request<any>(`/admin/doctors/${doctorId}`, { method: "DELETE" }),
  getAdminPatients: (page = 1, limit = 20) =>
    request<any>(`/admin/patients?page=${page}&limit=${limit}`),
  deleteAdminPatient: (patientId: number) =>
    request<any>(`/admin/patients/${patientId}`, { method: "DELETE" }),
  changeUserRole: (userId: number, newRole: string) =>
    request<any>(`/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ new_role: newRole }),
    }),

  // Publications endpoints
  getPublications: (page = 1, limit = 20, category?: string) =>
    request<any>(`/publications/?page=${page}&limit=${limit}${category ? `&category=${category}` : ""}`),
  getPublication: (id: number) => request<any>(`/publications/${id}`),
  getAdminPublications: (page = 1, limit = 20) =>
    request<any>(`/publications/admin/list?page=${page}&limit=${limit}`),
  createPublication: (payload: any) =>
    request<any>("/publications/", { method: "POST", body: JSON.stringify(payload) }),
  updatePublication: (id: number, payload: any) =>
    request<any>(`/publications/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePublication: (id: number) =>
    request<any>(`/publications/${id}`, { method: "DELETE" }),
  downloadPublicationFile: (id: number) =>
    request<any>(`/publications/${id}/download`),
};