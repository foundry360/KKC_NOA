import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryIngestRuntime,
  setIngestRuntime,
} from "@/src/infrastructure/composition/ingest";
import {
  admitPatient,
  getMeridianStore,
  getSalesforceSubmission,
  serializeAdmissionPayload,
  submitAdmissionToSalesforce,
} from "@/src/meridian/store/runtime";
import { SEED_PATIENTS } from "@/src/meridian/data/seed";
import {
  SALESFORCE_PAYLOAD_MAX_LENGTH,
  createMemorySubmissionStore,
  handleSubmissionRequest,
  type FetchLike,
} from "@/supabase/functions/submit-admission-to-salesforce/salesforce";

const SUPABASE_URL = "https://test-project.supabase.co";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/submit-admission-to-salesforce`;
const INSTANCE = "https://instance.example.my.salesforce.com";
const SF_ENV: Record<string, string> = {
  SF_CLIENT_ID_hlsDev: "test-id",
  SF_CLIENT_SECRET_hlsDev: "test-secret",
  SF_LOGIN_BASE_URL: "https://login.example.my.salesforce.com",
  SF_API_VERSION: "v67.0",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Wires Meridian's server-side fetch to the real Edge Function handler, which
 * in turn talks to a scripted Salesforce mock.
 */
function installIntegration(opts: { createResponses?: Array<Response | Error> } = {}) {
  const createResponses = [...(opts.createResponses ?? [])];
  const salesforceBodies: Array<{ Payload__c: string }> = [];
  let functionCalls = 0;
  const store = createMemorySubmissionStore();

  const salesforceFetch: FetchLike = async (url, init) => {
    if (url.endsWith("/services/oauth2/token")) {
      return json(200, { access_token: "tok", instance_url: INSTANCE, token_type: "Bearer" });
    }
    if (url === `${INSTANCE}/services/data/v67.0/sobjects/Admission__c`) {
      salesforceBodies.push(JSON.parse(String(init?.body)));
      const next = createResponses.shift();
      if (next instanceof Error) throw next;
      return next ?? json(201, { id: `a0X00000000000${salesforceBodies.length}AAA`, success: true, errors: [] });
    }
    throw new Error(`Unexpected Salesforce URL ${url}`);
  };

  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url !== FUNCTION_URL) throw new Error(`Unexpected URL ${url}`);
    functionCalls++;
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-service-role");
    const result = await handleSubmissionRequest(JSON.parse(String(init?.body)), {
      getEnv: (k) => SF_ENV[k],
      fetchImpl: salesforceFetch,
      store,
    });
    return json(result.httpStatus, result.body);
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    store,
    salesforceBodies,
    get functionCalls() {
      return functionCalls;
    },
  };
}

async function admitJohnSmith() {
  const patient = SEED_PATIENTS[0];
  return admitPatient({
    patientId: patient.id,
    encounterClass: "INPATIENT",
    admissionType: "Emergency",
    facilityId: "fac-jax",
    departmentId: "dep-medsurg",
    unit: "4 South",
    room: "402",
    admittedAt: new Date().toISOString(),
    attendingProviderId: "prov-williams",
    principalDiagnosis: "Pneumonia",
    service: "Internal Medicine",
    coverage: { ...patient.coverage },
  });
}

describe("Meridian admission → Supabase Edge Function → Salesforce Admission__c", () => {
  beforeEach(() => {
    setIngestRuntime(createMemoryIngestRuntime());
    const g = globalThis as typeof globalThis & {
      __meridianStore?: unknown;
      __meridianStoreVersion?: number;
    };
    g.__meridianStore = undefined;
    g.__meridianStoreVersion = undefined;
    void getMeridianStore();
    vi.stubEnv("SUPABASE_URL", SUPABASE_URL);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
    vi.stubEnv("SALESFORCE_SUBMIT_FUNCTION_URL", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("admission generates a FHIR payload and a PENDING Salesforce submission", async () => {
    const { encounter, fhirEvent } = await admitJohnSmith();
    expect(fhirEvent.bundle.resourceType).toBe("Bundle");
    const record = getSalesforceSubmission(encounter.id);
    expect(record).toMatchObject({ status: "PENDING", attemptCount: 0, fhirEventId: fhirEvent.id });

    const payload = serializeAdmissionPayload(fhirEvent.bundle);
    expect(() => JSON.parse(payload)).not.toThrow();
    expect(payload.length).toBeLessThanOrEqual(SALESFORCE_PAYLOAD_MAX_LENGTH);
    const types = (JSON.parse(payload).entry as Array<{ resource: { resourceType: string } }>).map(
      (e) => e.resource.resourceType
    );
    expect(types).toEqual(expect.arrayContaining(["Patient", "Encounter", "Coverage", "Organization", "Practitioner"]));
  });

  it("submits the unchanged FHIR payload to Payload__c and persists the record id", async () => {
    const integration = installIntegration();
    const { encounter, fhirEvent } = await admitJohnSmith();

    const result = await submitAdmissionToSalesforce(encounter.id);
    expect(result.outcome).toBe("submitted");
    expect(result.record).toMatchObject({
      status: "SUBMITTED",
      salesforceRecordId: "a0X000000000001AAA",
      attemptCount: 1,
    });
    expect(result.record.submittedAt).toBeTruthy();

    expect(integration.salesforceBodies).toHaveLength(1);
    expect(integration.salesforceBodies[0].Payload__c).toBe(serializeAdmissionPayload(fhirEvent.bundle));
    expect(JSON.parse(integration.salesforceBodies[0].Payload__c)).toEqual(fhirEvent.bundle);
    expect(getSalesforceSubmission(encounter.id)?.status).toBe("SUBMITTED");
  });

  it("a failed submission is not marked successful and the admission is unaffected", async () => {
    installIntegration({ createResponses: [new TypeError("fetch failed")] });
    const { encounter } = await admitJohnSmith();

    const result = await submitAdmissionToSalesforce(encounter.id);
    expect(result.outcome).toBe("failed");
    expect(result.record.status).toBe("RETRYABLE");
    expect(result.record.salesforceRecordId).toBeUndefined();
    expect(result.record.errorType).toBe("SALESFORCE_CONNECTION");
    expect(result.record.errorMessage).not.toMatch(/Bearer|secret|tok/i);
    expect(getMeridianStore().encounters.get(encounter.id)?.status).toBe("Admitted");
  });

  it("retry resubmits the same stored payload and records the new attempt", async () => {
    const integration = installIntegration({
      createResponses: [json(503, [{ errorCode: "SERVER_UNAVAILABLE" }])],
    });
    const { encounter } = await admitJohnSmith();
    const eventCountBefore = getMeridianStore().fhirEvents.size;

    expect((await submitAdmissionToSalesforce(encounter.id)).record.status).toBe("RETRYABLE");
    const retry = await submitAdmissionToSalesforce(encounter.id);
    expect(retry.outcome).toBe("submitted");
    expect(retry.record.attemptCount).toBe(2);
    expect(retry.record.attempts.map((a) => a.status)).toEqual(["RETRYABLE", "SUBMITTED"]);
    expect(integration.salesforceBodies[0].Payload__c).toBe(integration.salesforceBodies[1].Payload__c);
    expect(getMeridianStore().fhirEvents.size).toBe(eventCountBefore);
  });

  it("prevents duplicate Salesforce records (double click and post-success resubmit)", async () => {
    const integration = installIntegration();
    const { encounter } = await admitJohnSmith();

    const [a, b] = await Promise.all([
      submitAdmissionToSalesforce(encounter.id),
      submitAdmissionToSalesforce(encounter.id),
    ]);
    expect([a.outcome, b.outcome].sort()).toEqual(["in_progress", "submitted"]);

    const again = await submitAdmissionToSalesforce(encounter.id);
    expect(again.outcome).toBe("already_submitted");
    expect(integration.salesforceBodies).toHaveLength(1);
    expect(integration.functionCalls).toBe(1);
  });

  it("Edge Function claim blocks duplicates even if Meridian loses its local state", async () => {
    const integration = installIntegration();
    const { encounter } = await admitJohnSmith();
    await submitAdmissionToSalesforce(encounter.id);

    getMeridianStore().salesforceSubmissions.get(encounter.id)!.status = "PENDING";
    const again = await submitAdmissionToSalesforce(encounter.id);
    expect(again.outcome).toBe("already_submitted");
    expect(again.record.salesforceRecordId).toBe("a0X000000000001AAA");
    expect(integration.salesforceBodies).toHaveLength(1);
  });

  it("reports a sanitized configuration failure when Supabase is not configured", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { encounter } = await admitJohnSmith();
    const result = await submitAdmissionToSalesforce(encounter.id);
    expect(result.record).toMatchObject({ status: "FAILED", errorType: "CONFIGURATION" });
  });
});
