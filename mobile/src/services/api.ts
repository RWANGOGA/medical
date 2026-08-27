import AsyncStorage from "@react-native-async-storage/async-storage";

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

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // ALWAYS ensure we have the latest token (memory first, then storage)
  if (!authToken) {
    authToken = await AsyncStorage.getItem("authToken");
  }
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, { headers, ...options });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.detail || `API Error: ${response.status}`, response.status);
  }
  return response.json();
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