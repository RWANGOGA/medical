/**
 * API client: verifies the patient edit flow wiring (PUT /patients/{id}),
 * auth header attachment, and error propagation.
 */
import { api, setAuthToken } from "../api";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8002/api/v1";

type FetchCall = { url: string; init: RequestInit };

const jsonResponse = (body: any, ok = true, status = 200) => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(body),
});

describe("api.updatePatient", () => {
  let calls: FetchCall[];

  beforeEach(() => {
    calls = [];
    global.fetch = jest.fn((url: any, init: any) => {
      calls.push({ url, init });
      return Promise.resolve(jsonResponse({ id: 5, diagnosis: "Updated diagnosis" }));
    }) as any;
  });

  it("issues PUT /patients/{id} with a JSON body", async () => {
    await setAuthToken("test-token");
    const payload = { diagnosis: "Updated diagnosis" };
    const result = await api.updatePatient(5, payload);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${BASE_URL}/patients/5`);
    expect(calls[0].init.method).toBe("PUT");
    expect(JSON.parse(calls[0].init.body as string)).toEqual(payload);
    expect(result.diagnosis).toBe("Updated diagnosis");
  });

  it("sends the stored bearer token", async () => {
    await setAuthToken("bearer-check-token");
    await api.updatePatient("abc-1", { name: "Renamed" });

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer bearer-check-token");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("supports string ids for deep-linked edit mode", async () => {
    await setAuthToken("t");
    await api.updatePatient("42", { age: 30 });
    expect(calls[0].url).toBe(`${BASE_URL}/patients/42`);
  });

  it("throws a readable error when the server rejects the update", async () => {
    await setAuthToken("t");
    global.fetch = jest.fn(() =>
      Promise.resolve(jsonResponse({ detail: "Patient not found" }, false, 404))
    ) as any;

    await expect(api.updatePatient(999, { diagnosis: "x" })).rejects.toThrow("Patient not found");
  });
});

describe("api.searchPatients", () => {
  it("posts the query to /search/patients for the dedup flow", async () => {
    global.fetch = jest.fn((_url: any, _init: any) =>
      Promise.resolve(jsonResponse({ patients: [], duplicate_warning: null }))
    ) as any;

    const res = await api.searchPatients("Namugalu");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE_URL}/search/patients`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ query: "Namugalu" });
    expect(res.patients).toEqual([]);
  });
});
