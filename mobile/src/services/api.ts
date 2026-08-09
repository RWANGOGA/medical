import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "http://localhost:8002/api/v1";

let authToken: string | null = null;

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
    throw new Error(errorData.detail || `API Error: ${response.status}`);
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
  
  // Duplicate check (NEW)
  checkDuplicate: (payload: any) =>
    request<any>("/patients/check-duplicate", { method: "POST", body: JSON.stringify(payload) }),

  // CDS
  getCDSRecommendation: (payload: any) =>
    request<any>("/cds/recommend", { method: "POST", body: JSON.stringify(payload) }),

  // Surveillance Dashboard
  getDashboardTrends: () => request<any[]>("/dashboard/trends"),
  getDashboardAntibiogram: () => request<any>("/dashboard/antibiogram"),
  getDashboardAware: () => request<any[]>("/dashboard/aware"),
  getDashboardAlerts: () => request<string[]>("/dashboard/alerts"),

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
  addLabResult: (payload: any) =>
    request<any>("/lab/results", { method: "POST", body: JSON.stringify(payload) }),

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
};