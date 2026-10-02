import { describe, expect, it, vi } from "vitest";
import {
  SALESFORCE_PAYLOAD_MAX_LENGTH,
  SalesforceIntegrationError,
  createMemorySubmissionStore,
  createSalesforceAdmission,
  getSalesforceToken,
  handleSubmissionRequest,
  readSalesforceConfig,
  sanitizeMessage,
  submitPayloadToSalesforce,
  validateSubmissionRequest,
  type FetchLike,
  type SalesforceConfig,
} from "@/supabase/functions/submit-admission-to-salesforce/salesforce";

const LOGIN = "https://login.example.my.salesforce.com";
const INSTANCE = "https://instance.example.my.salesforce.com";
const CONFIG: SalesforceConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  loginBaseUrl: LOGIN,
  apiVersion: "v67.0",
};
const ENV: Record<string, string> = {
  SF_CLIENT_ID_hlsDev: CONFIG.clientId,
  SF_CLIENT_SECRET_hlsDev: CONFIG.clientSecret,
  SF_LOGIN_BASE_URL: LOGIN,
  SF_API_VERSION: "v67.0",
};

const PAYLOAD = JSON.stringify(
  { resourceType: "Bundle", type: "message", entry: [{ resource: { resourceType: "Patient" } }] },
  null,
  2
);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Call = { url: string; init?: RequestInit };

/** Scripted Salesforce: token responses and sobject responses are consumed in order. */
function salesforceMock(opts: {
  tokens?: Array<Response | Error>;
  creates?: Array<Response | Error>;
}) {
  const tokens = [...(opts.tokens ?? [])];
  const creates = [...(opts.creates ?? [])];
  const calls: Call[] = [];
  const fetchImpl: FetchLike = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const queue = url.endsWith("/services/oauth2/token") ? tokens : creates;
    const next =
      queue.shift() ??
      (url.endsWith("/services/oauth2/token")
        ? json(200, { access_token: "00Dxx0000000001!AQ.token", instance_url: INSTANCE, token_type: "Bearer" })
        : json(201, { id: "a0X000000000001AAA", success: true, errors: [] }));
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetchImpl, calls };
}

describe("Salesforce authentication (client credentials)", () => {
  it("acquires a token and uses the returned instance_url", async () => {
    const { fetchImpl, calls } = salesforceMock({
      tokens: [json(200, { access_token: "tok-1", instance_url: `${INSTANCE}/`, token_type: "Bearer" })],
    });
    const token = await getSalesforceToken(CONFIG, fetchImpl);
    expect(token).toEqual({ accessToken: "tok-1", instanceUrl: INSTANCE });

    expect(calls[0].url).toBe(`${LOGIN}/services/oauth2/token`);
    expect(calls[0].init?.method).toBe("POST");
    expect((calls[0].init?.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    );
    const form = new URLSearchParams(String(calls[0].init?.body));
    expect(form.get("grant_type")).toBe("client_credentials");
    expect(form.get("client_id")).toBe(CONFIG.clientId);
    expect(form.get("client_secret")).toBe(CONFIG.clientSecret);
  });

  it("returns a sanitized authentication failure without leaking credentials", async () => {
    const { fetchImpl } = salesforceMock({
      tokens: [json(400, { error: "invalid_client", error_description: "client_secret=test-client-secret invalid" })],
    });
    const err = await getSalesforceToken(CONFIG, fetchImpl).catch((e) => e);
    expect(err).toBeInstanceOf(SalesforceIntegrationError);
    expect(err.errorType).toBe("SALESFORCE_AUTHENTICATION");
    expect(err.retryable).toBe(false);
    expect(err.message).toBe("Salesforce authentication failed.");
    expect(err.message).not.toContain("test-client-secret");
  });

  it("rejects a token response without an https instance_url", async () => {
    const { fetchImpl } = salesforceMock({
      tokens: [json(200, { access_token: "tok", instance_url: "http://evil.example" })],
    });
    await expect(getSalesforceToken(CONFIG, fetchImpl)).rejects.toMatchObject({
      errorType: "SALESFORCE_AUTHENTICATION",
    });
  });

  it("fails clearly when credentials are missing", () => {
    expect(() => readSalesforceConfig(() => undefined)).toThrowError(
      "Salesforce integration credentials are not configured."
    );
    try {
      readSalesforceConfig((k) => (k === "SF_CLIENT_ID_hlsDev" ? "id" : undefined));
    } catch (e) {
      expect((e as SalesforceIntegrationError).errorType).toBe("CONFIGURATION");
    }
  });

  it("reads API version and login URL from env with defaults", () => {
    const cfg = readSalesforceConfig((k) =>
      k === "SF_CLIENT_ID_hlsDev" ? "id" : k === "SF_CLIENT_SECRET_hlsDev" ? "secret" : undefined
    );
    expect(cfg.apiVersion).toBe("v67.0");
    expect(cfg.loginBaseUrl).toBe(
      "https://extraordinary-astro-253310-dev-ed.develop.my.salesforce.com"
    );
  });
});

describe("Salesforce Admission__c creation", () => {
  it("creates the record on 201 and sends the payload unchanged in Payload__c", async () => {
    const { fetchImpl, calls } = salesforceMock({});
    const result = await createSalesforceAdmission(PAYLOAD, "tok", INSTANCE, "v67.0", fetchImpl);
    expect(result).toEqual({ kind: "created", id: "a0X000000000001AAA", httpStatus: 201 });

    expect(calls[0].url).toBe(`${INSTANCE}/services/data/v67.0/sobjects/Admission__c`);
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(String(calls[0].init?.body));
    expect(Object.keys(body)).toEqual(["Payload__c"]);
    expect(body.Payload__c).toBe(PAYLOAD);
  });

  it("re-authenticates and retries exactly once on 401 INVALID_SESSION_ID", async () => {
    const invalid = () =>
      json(401, [{ errorCode: "INVALID_SESSION_ID", message: "Session expired or invalid" }]);
    const { fetchImpl, calls } = salesforceMock({ creates: [invalid()] });
    const outcome = await submitPayloadToSalesforce(PAYLOAD, CONFIG, fetchImpl);
    expect(outcome).toMatchObject({ success: true, salesforceRecordId: "a0X000000000001AAA" });
    expect(calls.filter((c) => c.url.endsWith("/oauth2/token"))).toHaveLength(2);
    expect(calls.filter((c) => c.url.includes("/sobjects/"))).toHaveLength(2);

    const twice = salesforceMock({ creates: [invalid(), invalid()] });
    const failed = await submitPayloadToSalesforce(PAYLOAD, CONFIG, twice.fetchImpl);
    expect(failed).toMatchObject({
      success: false,
      status: "failed",
      errorType: "SALESFORCE_AUTHENTICATION",
    });
    expect(twice.calls.filter((c) => c.url.includes("/sobjects/"))).toHaveLength(2);
  });

  it("maps Salesforce validation errors to SALESFORCE_VALIDATION (not retryable)", async () => {
    const { fetchImpl } = salesforceMock({
      creates: [
        json(400, [
          { errorCode: "STRING_TOO_LONG", message: "Payload: data value too large", fields: ["Payload__c"] },
        ]),
      ],
    });
    const outcome = await submitPayloadToSalesforce(PAYLOAD, CONFIG, fetchImpl);
    expect(outcome).toEqual({
      success: false,
      status: "failed",
      errorType: "SALESFORCE_VALIDATION",
      message: "STRING_TOO_LONG: Payload: data value too large",
      httpStatus: 400,
    });
  });

  it("maps network failures and 5xx to retryable SALESFORCE_CONNECTION", async () => {
    const network = salesforceMock({ creates: [new TypeError("fetch failed")] });
    expect(await submitPayloadToSalesforce(PAYLOAD, CONFIG, network.fetchImpl)).toMatchObject({
      success: false,
      status: "retryable",
      errorType: "SALESFORCE_CONNECTION",
    });

    const unavailable = salesforceMock({ creates: [json(503, [{ errorCode: "SERVER_UNAVAILABLE" }])] });
    expect(await submitPayloadToSalesforce(PAYLOAD, CONFIG, unavailable.fetchImpl)).toMatchObject({
      status: "retryable",
      errorType: "SALESFORCE_CONNECTION",
    });

    const tokenDown = salesforceMock({ tokens: [new TypeError("fetch failed")] });
    expect(await submitPayloadToSalesforce(PAYLOAD, CONFIG, tokenDown.fetchImpl)).toMatchObject({
      status: "retryable",
      errorType: "SALESFORCE_CONNECTION",
    });
  });

  it("never reports success without a record id", async () => {
    const { fetchImpl } = salesforceMock({ creates: [json(201, { success: true })] });
    const outcome = await submitPayloadToSalesforce(PAYLOAD, CONFIG, fetchImpl);
    expect(outcome.success).toBe(false);
  });
});

describe("Payload validation", () => {
  it("accepts a serialized FHIR Bundle unchanged", () => {
    expect(validateSubmissionRequest({ admissionId: "enc-1", payload: PAYLOAD })).toEqual({
      admissionId: "enc-1",
      payload: PAYLOAD,
    });
  });

  it("requires admissionId and a JSON FHIR payload", () => {
    expect(() => validateSubmissionRequest({ payload: PAYLOAD })).toThrow("admissionId is required.");
    expect(() => validateSubmissionRequest({ admissionId: "a" })).toThrow("payload is required.");
    expect(() => validateSubmissionRequest({ admissionId: "a", payload: "{not json" })).toThrow(
      "payload must be valid JSON."
    );
    expect(() => validateSubmissionRequest({ admissionId: "a", payload: "{}" })).toThrow(
      /resourceType/
    );
  });

  it("rejects payloads over the Payload__c limit instead of truncating", () => {
    const big = JSON.stringify({
      resourceType: "Bundle",
      pad: "x".repeat(SALESFORCE_PAYLOAD_MAX_LENGTH),
    });
    try {
      validateSubmissionRequest({ admissionId: "a", payload: big });
      expect.unreachable();
    } catch (e) {
      expect((e as SalesforceIntegrationError).errorType).toBe("PAYLOAD_TOO_LARGE");
      expect((e as SalesforceIntegrationError).httpStatus).toBe(413);
    }
  });

  it("redacts credential-like text", () => {
    const s = sanitizeMessage(
      'Bearer 00Dxx0000000001!AQabc client_secret=shh "access_token":"t0k"'
    );
    expect(s).not.toContain("00Dxx0000000001!AQabc");
    expect(s).not.toContain("shh");
    expect(s).not.toContain("t0k");
  });
});

describe("Edge Function request handler", () => {
  it("submits, persists SUBMITTED with record id, and logs no secrets", async () => {
    const store = createMemorySubmissionStore();
    const { fetchImpl } = salesforceMock({});
    const logs: string[] = [];
    const result = await handleSubmissionRequest(
      { admissionId: "enc-1", payload: PAYLOAD },
      { getEnv: (k) => ENV[k], fetchImpl, store, log: (e) => logs.push(JSON.stringify(e)) }
    );
    expect(result.httpStatus).toBe(201);
    expect(result.body).toMatchObject({
      success: true,
      status: "submitted",
      salesforceRecordId: "a0X000000000001AAA",
      salesforceRecordUrl: `${INSTANCE}/a0X000000000001AAA`,
      attemptCount: 1,
    });
    const row = store.rows.get("enc-1")!;
    expect(row.status).toBe("SUBMITTED");
    expect(row.salesforce_record_id).toBe("a0X000000000001AAA");
    expect(row.payload_length).toBe(PAYLOAD.length);
    expect(JSON.stringify(row)).not.toContain("token");

    const allLogs = logs.join("\n");
    expect(allLogs).not.toContain(CONFIG.clientSecret);
    expect(allLogs).not.toContain("00Dxx0000000001");
    expect(allLogs).not.toMatch(/Bearer/);
  });

  it("does not create a second record once SUBMITTED", async () => {
    const store = createMemorySubmissionStore();
    const { fetchImpl, calls } = salesforceMock({});
    const deps = { getEnv: (k: string) => ENV[k], fetchImpl, store };
    await handleSubmissionRequest({ admissionId: "enc-1", payload: PAYLOAD }, deps);
    const second = await handleSubmissionRequest({ admissionId: "enc-1", payload: PAYLOAD }, deps);
    expect(second.httpStatus).toBe(200);
    expect(second.body).toMatchObject({ success: true, duplicate: true, salesforceRecordId: "a0X000000000001AAA" });
    expect(calls.filter((c) => c.url.includes("/sobjects/"))).toHaveLength(1);
  });

  it("rejects a concurrent submission while one is in flight", async () => {
    const store = createMemorySubmissionStore();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const base = salesforceMock({});
    const slowFetch: FetchLike = async (url, init) => {
      if (url.includes("/sobjects/")) await gate;
      return base.fetchImpl(url, init);
    };
    const deps = { getEnv: (k: string) => ENV[k], fetchImpl: slowFetch, store };

    const first = handleSubmissionRequest({ admissionId: "enc-1", payload: PAYLOAD }, deps);
    await new Promise((r) => setTimeout(r, 0));
    const second = await handleSubmissionRequest({ admissionId: "enc-1", payload: PAYLOAD }, deps);
    expect(second.httpStatus).toBe(409);
    expect(second.body).toMatchObject({ success: false, status: "submitting", errorType: "DUPLICATE_IN_PROGRESS" });

    release();
    expect((await first).body.success).toBe(true);
    expect(base.calls.filter((c) => c.url.includes("/sobjects/"))).toHaveLength(1);
  });

  it("records RETRYABLE on connection failure and allows a retry", async () => {
    const store = createMemorySubmissionStore();
    const { fetchImpl, calls } = salesforceMock({ creates: [new TypeError("fetch failed")] });
    const deps = { getEnv: (k: string) => ENV[k], fetchImpl, store };

    const failed = await handleSubmissionRequest({ admissionId: "enc-1", payload: PAYLOAD }, deps);
    expect(failed.httpStatus).toBe(503);
    expect(failed.body).toMatchObject({ success: false, status: "retryable", errorType: "SALESFORCE_CONNECTION" });
    expect(store.rows.get("enc-1")!.status).toBe("RETRYABLE");
    expect(store.rows.get("enc-1")!.salesforce_record_id).toBeNull();

    const retried = await handleSubmissionRequest({ admissionId: "enc-1", payload: PAYLOAD }, deps);
    expect(retried.body).toMatchObject({ success: true, attemptCount: 2 });
    const creates = calls.filter((c) => c.url.includes("/sobjects/"));
    expect(JSON.parse(String(creates[0].init?.body)).Payload__c).toBe(
      JSON.parse(String(creates[1].init?.body)).Payload__c
    );
  });

  it("records FAILED/CONFIGURATION when Salesforce secrets are missing", async () => {
    const store = createMemorySubmissionStore();
    const { fetchImpl, calls } = salesforceMock({});
    const result = await handleSubmissionRequest(
      { admissionId: "enc-1", payload: PAYLOAD },
      { getEnv: () => undefined, fetchImpl, store }
    );
    expect(result.body).toMatchObject({ success: false, status: "failed", errorType: "CONFIGURATION" });
    expect(calls).toHaveLength(0);
    expect(store.rows.get("enc-1")!.status).toBe("FAILED");
  });

  it("returns 400 for invalid requests without touching Salesforce or the store", async () => {
    const store = createMemorySubmissionStore();
    const { fetchImpl, calls } = salesforceMock({});
    const result = await handleSubmissionRequest(
      { admissionId: "enc-1", payload: "nope" },
      { getEnv: (k) => ENV[k], fetchImpl, store }
    );
    expect(result.httpStatus).toBe(400);
    expect(calls).toHaveLength(0);
    expect(store.rows.size).toBe(0);
  });
});
