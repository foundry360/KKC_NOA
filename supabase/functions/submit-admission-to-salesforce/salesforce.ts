// Runtime-agnostic Salesforce integration core. Must not import Deno- or
// Node-specific modules: it is executed by the Supabase Edge Function (Deno)
// and by the Vitest suite (Node).

export const SALESFORCE_PAYLOAD_MAX_LENGTH = 130_768;
export const INTEGRATION_TYPE = "SALESFORCE_ADMISSION";
export const DEFAULT_SF_API_VERSION = "v67.0";
export const DEFAULT_SF_LOGIN_BASE_URL =
  "https://extraordinary-astro-253310-dev-ed.develop.my.salesforce.com";

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ADMISSION_ID_LENGTH = 128;

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export type SalesforceConfig = {
  clientId: string;
  clientSecret: string;
  loginBaseUrl: string;
  apiVersion: string;
};

export type ErrorType =
  | "VALIDATION"
  | "PAYLOAD_TOO_LARGE"
  | "CONFIGURATION"
  | "SALESFORCE_AUTHENTICATION"
  | "SALESFORCE_VALIDATION"
  | "SALESFORCE_CONNECTION"
  | "DUPLICATE_IN_PROGRESS"
  | "STATUS_STORE";

export type IntegrationStatus =
  | "PENDING"
  | "SUBMITTING"
  | "SUBMITTED"
  | "FAILED"
  | "RETRYABLE";

export class SalesforceIntegrationError extends Error {
  constructor(
    readonly errorType: ErrorType,
    message: string,
    readonly retryable: boolean,
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = "SalesforceIntegrationError";
  }
}

export function readSalesforceConfig(
  getEnv: (key: string) => string | undefined
): SalesforceConfig {
  const clientId = getEnv("SF_CLIENT_ID_hlsDev")?.trim();
  const clientSecret = getEnv("SF_CLIENT_SECRET_hlsDev")?.trim();
  if (!clientId || !clientSecret) {
    throw new SalesforceIntegrationError(
      "CONFIGURATION",
      "Salesforce integration credentials are not configured.",
      false
    );
  }
  const loginBaseUrl = (
    getEnv("SF_LOGIN_BASE_URL")?.trim() || DEFAULT_SF_LOGIN_BASE_URL
  ).replace(/\/+$/, "");
  const apiVersion = getEnv("SF_API_VERSION")?.trim() || DEFAULT_SF_API_VERSION;
  return { clientId, clientSecret, loginBaseUrl, apiVersion };
}

/** Strips anything that looks like a credential before text reaches logs or the UI. */
export function sanitizeMessage(raw: string, maxLength = 300): string {
  return raw
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/00D[A-Za-z0-9]{12,15}![A-Za-z0-9._-]+/g, "[redacted]")
    .replace(/(client_secret|access_token|client_id)=[^&\s]+/gi, "$1=[redacted]")
    .replace(/"(client_secret|access_token|client_id)"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"')
    .slice(0, maxLength);
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

export type ValidatedSubmission = {
  admissionId: string;
  payload: string;
};

export function validateSubmissionRequest(body: unknown): ValidatedSubmission {
  if (!body || typeof body !== "object") {
    throw new SalesforceIntegrationError(
      "VALIDATION",
      "Request body must be a JSON object.",
      false,
      400
    );
  }
  const { admissionId, payload } = body as {
    admissionId?: unknown;
    payload?: unknown;
  };

  if (typeof admissionId !== "string" || !admissionId.trim()) {
    throw new SalesforceIntegrationError(
      "VALIDATION",
      "admissionId is required.",
      false,
      400
    );
  }
  if (admissionId.length > MAX_ADMISSION_ID_LENGTH) {
    throw new SalesforceIntegrationError(
      "VALIDATION",
      "admissionId is too long.",
      false,
      400
    );
  }

  let serialized: string;
  if (typeof payload === "string") {
    serialized = payload;
  } else if (payload && typeof payload === "object") {
    serialized = JSON.stringify(payload, null, 2);
  } else {
    throw new SalesforceIntegrationError(
      "VALIDATION",
      "payload is required.",
      false,
      400
    );
  }
  if (!serialized.trim()) {
    throw new SalesforceIntegrationError(
      "VALIDATION",
      "payload is required.",
      false,
      400
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new SalesforceIntegrationError(
      "VALIDATION",
      "payload must be valid JSON.",
      false,
      400
    );
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { resourceType?: unknown }).resourceType !== "string"
  ) {
    throw new SalesforceIntegrationError(
      "VALIDATION",
      "payload must be a FHIR resource (missing resourceType).",
      false,
      400
    );
  }

  if (serialized.length > SALESFORCE_PAYLOAD_MAX_LENGTH) {
    throw new SalesforceIntegrationError(
      "PAYLOAD_TOO_LARGE",
      `FHIR payload is ${serialized.length} characters; Salesforce Payload__c allows at most ${SALESFORCE_PAYLOAD_MAX_LENGTH}.`,
      false,
      413
    );
  }

  return { admissionId: admissionId.trim(), payload: serialized };
}

// ---------------------------------------------------------------------------
// OAuth 2.0 Client Credentials
// ---------------------------------------------------------------------------

export type SalesforceToken = {
  accessToken: string;
  instanceUrl: string;
};

async function timedFetch(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit
): Promise<Response> {
  return fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function getSalesforceToken(
  config: SalesforceConfig,
  fetchImpl: FetchLike
): Promise<SalesforceToken> {
  let response: Response;
  try {
    response = await timedFetch(
      fetchImpl,
      `${config.loginBaseUrl}/services/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }).toString(),
      }
    );
  } catch {
    throw new SalesforceIntegrationError(
      "SALESFORCE_CONNECTION",
      "Could not reach Salesforce for authentication. Please retry.",
      true
    );
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new SalesforceIntegrationError(
      retryable ? "SALESFORCE_CONNECTION" : "SALESFORCE_AUTHENTICATION",
      retryable
        ? "Salesforce authentication is temporarily unavailable. Please retry."
        : "Salesforce authentication failed.",
      retryable,
      response.status
    );
  }

  let json: { access_token?: unknown; instance_url?: unknown };
  try {
    json = await response.json();
  } catch {
    throw new SalesforceIntegrationError(
      "SALESFORCE_AUTHENTICATION",
      "Salesforce authentication failed.",
      false,
      response.status
    );
  }

  const accessToken =
    typeof json.access_token === "string" ? json.access_token : "";
  const instanceUrl =
    typeof json.instance_url === "string"
      ? json.instance_url.replace(/\/+$/, "")
      : "";
  if (!accessToken || !/^https:\/\/[^/\s]+$/i.test(instanceUrl)) {
    throw new SalesforceIntegrationError(
      "SALESFORCE_AUTHENTICATION",
      "Salesforce authentication failed.",
      false,
      response.status
    );
  }
  return { accessToken, instanceUrl };
}

// ---------------------------------------------------------------------------
// Admission__c creation
// ---------------------------------------------------------------------------

export type CreateAdmissionResult =
  | { kind: "created"; id: string; httpStatus: number }
  | { kind: "invalid_session"; httpStatus: number }
  | {
      kind: "error";
      errorType: ErrorType;
      retryable: boolean;
      message: string;
      httpStatus?: number;
    };

type SalesforceApiError = { errorCode?: string; message?: string; fields?: string[] };

function describeSalesforceErrors(body: unknown): string {
  const list = Array.isArray(body) ? (body as SalesforceApiError[]) : [];
  const first = list[0];
  if (!first) return "Salesforce rejected the Admission__c record.";
  const code = first.errorCode ? `${first.errorCode}: ` : "";
  return sanitizeMessage(`${code}${first.message ?? "Record rejected"}`);
}

export async function createSalesforceAdmission(
  payload: string,
  accessToken: string,
  instanceUrl: string,
  apiVersion: string,
  fetchImpl: FetchLike
): Promise<CreateAdmissionResult> {
  let response: Response;
  try {
    response = await timedFetch(
      fetchImpl,
      `${instanceUrl}/services/data/${apiVersion}/sobjects/Admission__c`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ Payload__c: payload }),
      }
    );
  } catch {
    return {
      kind: "error",
      errorType: "SALESFORCE_CONNECTION",
      retryable: true,
      message: "Could not reach Salesforce. Please retry.",
    };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 201 || response.status === 200) {
    const result = body as { id?: unknown; success?: unknown } | null;
    if (result && typeof result.id === "string" && result.success !== false) {
      return { kind: "created", id: result.id, httpStatus: response.status };
    }
    return {
      kind: "error",
      errorType: "SALESFORCE_VALIDATION",
      retryable: false,
      message: "Salesforce did not return a record ID.",
      httpStatus: response.status,
    };
  }

  if (response.status === 401) {
    return { kind: "invalid_session", httpStatus: 401 };
  }

  if (response.status === 429 || response.status >= 500) {
    return {
      kind: "error",
      errorType: "SALESFORCE_CONNECTION",
      retryable: true,
      message: "Salesforce is temporarily unavailable. Please retry.",
      httpStatus: response.status,
    };
  }

  return {
    kind: "error",
    errorType: "SALESFORCE_VALIDATION",
    retryable: false,
    message: describeSalesforceErrors(body),
    httpStatus: response.status,
  };
}

// ---------------------------------------------------------------------------
// Authenticate + create, retrying once on INVALID_SESSION_ID
// ---------------------------------------------------------------------------

export type SubmitOutcome =
  | {
      success: true;
      status: "submitted";
      salesforceRecordId: string;
      salesforceRecordUrl: string;
      httpStatus: number;
    }
  | {
      success: false;
      status: "failed" | "retryable";
      errorType: ErrorType;
      message: string;
      httpStatus?: number;
    };

function failure(err: SalesforceIntegrationError): SubmitOutcome {
  return {
    success: false,
    status: err.retryable ? "retryable" : "failed",
    errorType: err.errorType,
    message: err.message,
    httpStatus: err.httpStatus,
  };
}

export async function submitPayloadToSalesforce(
  payload: string,
  config: SalesforceConfig,
  fetchImpl: FetchLike
): Promise<SubmitOutcome> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let token: SalesforceToken;
    try {
      token = await getSalesforceToken(config, fetchImpl);
    } catch (e) {
      if (e instanceof SalesforceIntegrationError) return failure(e);
      throw e;
    }

    const result = await createSalesforceAdmission(
      payload,
      token.accessToken,
      token.instanceUrl,
      config.apiVersion,
      fetchImpl
    );

    if (result.kind === "created") {
      return {
        success: true,
        status: "submitted",
        salesforceRecordId: result.id,
        salesforceRecordUrl: `${token.instanceUrl}/${result.id}`,
        httpStatus: result.httpStatus,
      };
    }
    if (result.kind === "invalid_session") {
      if (attempt === 1) continue;
      return {
        success: false,
        status: "failed",
        errorType: "SALESFORCE_AUTHENTICATION",
        message: "Salesforce authentication failed.",
        httpStatus: 401,
      };
    }
    return {
      success: false,
      status: result.retryable ? "retryable" : "failed",
      errorType: result.errorType,
      message: result.message,
      httpStatus: result.httpStatus,
    };
  }
  /* c8 ignore next */
  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// Durable submission status (duplicate prevention)
// ---------------------------------------------------------------------------

export type SubmissionRow = {
  admission_id: string;
  integration_type: string;
  status: IntegrationStatus;
  salesforce_record_id: string | null;
  salesforce_record_url: string | null;
  submitted_at: string | null;
  last_attempt_at: string | null;
  error_type: string | null;
  error_message: string | null;
  http_status: number | null;
  attempt_count: number;
  payload_sha256: string | null;
  payload_length: number | null;
};

export type ClaimResult = { claimed: boolean; row: SubmissionRow };

export type SubmissionCompletion = {
  status: Extract<IntegrationStatus, "SUBMITTED" | "FAILED" | "RETRYABLE">;
  salesforce_record_id?: string | null;
  salesforce_record_url?: string | null;
  submitted_at?: string | null;
  error_type?: string | null;
  error_message?: string | null;
  http_status?: number | null;
};

export interface SubmissionStore {
  /**
   * Atomically moves the submission to SUBMITTING when it is PENDING, FAILED,
   * RETRYABLE, or a stale SUBMITTING; otherwise returns the current row
   * unchanged with claimed=false.
   */
  claim(input: {
    admissionId: string;
    payloadSha256: string;
    payloadLength: number;
  }): Promise<ClaimResult>;
  complete(admissionId: string, completion: SubmissionCompletion): Promise<SubmissionRow>;
}

export function createPostgrestSubmissionStore(opts: {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchImpl: FetchLike;
  staleAfterSeconds?: number;
}): SubmissionStore {
  const base = opts.supabaseUrl.replace(/\/+$/, "");
  const headers = {
    apikey: opts.serviceRoleKey,
    Authorization: `Bearer ${opts.serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function call(url: string, init: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await timedFetch(opts.fetchImpl, url, init);
    } catch {
      throw new SalesforceIntegrationError(
        "STATUS_STORE",
        "Integration status store is unavailable. Please retry.",
        true
      );
    }
    if (!res.ok) {
      throw new SalesforceIntegrationError(
        "STATUS_STORE",
        res.status === 404
          ? "Integration status store is not configured (apply the Meridian Salesforce migration)."
          : "Integration status store rejected the update.",
        res.status >= 500,
        res.status
      );
    }
    return res.json();
  }

  return {
    async claim({ admissionId, payloadSha256, payloadLength }) {
      const json = (await call(`${base}/rest/v1/rpc/claim_integration_submission`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_admission_id: admissionId,
          p_integration_type: INTEGRATION_TYPE,
          p_payload_sha256: payloadSha256,
          p_payload_length: payloadLength,
          p_stale_after_seconds: opts.staleAfterSeconds ?? 120,
        }),
      })) as ClaimResult;
      return json;
    },
    async complete(admissionId, completion) {
      const params = new URLSearchParams({
        admission_id: `eq.${admissionId}`,
        integration_type: `eq.${INTEGRATION_TYPE}`,
      });
      const rows = (await call(
        `${base}/rest/v1/meridian_integration_submissions?${params}`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify({ ...completion, updated_at: new Date().toISOString() }),
        }
      )) as SubmissionRow[];
      if (!rows[0]) {
        throw new SalesforceIntegrationError(
          "STATUS_STORE",
          "Integration status row was not found.",
          false
        );
      }
      return rows[0];
    },
  };
}

/** In-process store with the same semantics as the Postgres claim function. */
export function createMemorySubmissionStore(
  opts: { staleAfterMs?: number; now?: () => Date } = {}
): SubmissionStore & { rows: Map<string, SubmissionRow & { updated_at: string }> } {
  const rows = new Map<string, SubmissionRow & { updated_at: string }>();
  const now = opts.now ?? (() => new Date());
  const staleAfterMs = opts.staleAfterMs ?? 120_000;

  return {
    rows,
    async claim({ admissionId, payloadSha256, payloadLength }) {
      const ts = now().toISOString();
      let row = rows.get(admissionId);
      if (!row) {
        row = {
          admission_id: admissionId,
          integration_type: INTEGRATION_TYPE,
          status: "PENDING",
          salesforce_record_id: null,
          salesforce_record_url: null,
          submitted_at: null,
          last_attempt_at: null,
          error_type: null,
          error_message: null,
          http_status: null,
          attempt_count: 0,
          payload_sha256: null,
          payload_length: null,
          updated_at: ts,
        };
        rows.set(admissionId, row);
      }
      const stale =
        row.status === "SUBMITTING" &&
        now().getTime() - new Date(row.updated_at).getTime() > staleAfterMs;
      if (
        row.status === "PENDING" ||
        row.status === "FAILED" ||
        row.status === "RETRYABLE" ||
        stale
      ) {
        Object.assign(row, {
          status: "SUBMITTING" as const,
          attempt_count: row.attempt_count + 1,
          last_attempt_at: ts,
          updated_at: ts,
          payload_sha256: payloadSha256,
          payload_length: payloadLength,
          error_type: null,
          error_message: null,
        });
        return { claimed: true, row: { ...row } };
      }
      return { claimed: false, row: { ...row } };
    },
    async complete(admissionId, completion) {
      const row = rows.get(admissionId);
      if (!row) {
        throw new SalesforceIntegrationError(
          "STATUS_STORE",
          "Integration status row was not found.",
          false
        );
      }
      Object.assign(row, completion, { updated_at: now().toISOString() });
      return { ...row };
    },
  };
}

// ---------------------------------------------------------------------------
// Request handler (shared by the Edge Function and tests)
// ---------------------------------------------------------------------------

export type SubmissionResponseBody = {
  success: boolean;
  status: "submitted" | "submitting" | "failed" | "retryable";
  admissionId?: string;
  salesforceRecordId?: string;
  salesforceRecordUrl?: string;
  submittedAt?: string;
  attemptCount?: number;
  duplicate?: boolean;
  errorType?: ErrorType;
  message?: string;
};

export type HandlerResult = { httpStatus: number; body: SubmissionResponseBody };

export type HandlerDeps = {
  getEnv: (key: string) => string | undefined;
  fetchImpl: FetchLike;
  store: SubmissionStore;
  now?: () => Date;
  log?: (event: Record<string, unknown>) => void;
};

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromRow(row: SubmissionRow, extra: Partial<SubmissionResponseBody> = {}) {
  return {
    admissionId: row.admission_id,
    salesforceRecordId: row.salesforce_record_id ?? undefined,
    salesforceRecordUrl: row.salesforce_record_url ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    attemptCount: row.attempt_count,
    ...extra,
  };
}

export async function handleSubmissionRequest(
  body: unknown,
  deps: HandlerDeps
): Promise<HandlerResult> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});

  let request: ValidatedSubmission;
  try {
    request = validateSubmissionRequest(body);
  } catch (e) {
    if (e instanceof SalesforceIntegrationError) {
      log({ event: "validation_failed", errorType: e.errorType });
      return {
        httpStatus: e.httpStatus ?? 400,
        body: { success: false, status: "failed", errorType: e.errorType, message: e.message },
      };
    }
    throw e;
  }

  let claim: ClaimResult;
  try {
    claim = await deps.store.claim({
      admissionId: request.admissionId,
      payloadSha256: await sha256Hex(request.payload),
      payloadLength: request.payload.length,
    });
  } catch (e) {
    const err =
      e instanceof SalesforceIntegrationError
        ? e
        : new SalesforceIntegrationError(
            "STATUS_STORE",
            "Integration status store is unavailable. Please retry.",
            true
          );
    log({ event: "claim_failed", admissionId: request.admissionId, errorType: err.errorType });
    return {
      httpStatus: 503,
      body: {
        success: false,
        status: err.retryable ? "retryable" : "failed",
        admissionId: request.admissionId,
        errorType: err.errorType,
        message: err.message,
      },
    };
  }

  if (!claim.claimed) {
    if (claim.row.status === "SUBMITTED") {
      log({
        event: "duplicate_skipped",
        admissionId: request.admissionId,
        salesforceRecordId: claim.row.salesforce_record_id,
      });
      return {
        httpStatus: 200,
        body: { success: true, status: "submitted", duplicate: true, ...fromRow(claim.row) },
      };
    }
    log({ event: "duplicate_in_progress", admissionId: request.admissionId });
    return {
      httpStatus: 409,
      body: {
        success: false,
        status: "submitting",
        errorType: "DUPLICATE_IN_PROGRESS",
        message: "A Salesforce submission for this admission is already in progress.",
        ...fromRow(claim.row),
      },
    };
  }

  let outcome: SubmitOutcome;
  try {
    const config = readSalesforceConfig(deps.getEnv);
    outcome = await submitPayloadToSalesforce(request.payload, config, deps.fetchImpl);
  } catch (e) {
    outcome =
      e instanceof SalesforceIntegrationError
        ? failure(e)
        : {
            success: false,
            status: "retryable",
            errorType: "SALESFORCE_CONNECTION",
            message: "Salesforce submission failed. Please retry.",
          };
  }

  const completion: SubmissionCompletion = outcome.success
    ? {
        status: "SUBMITTED",
        salesforce_record_id: outcome.salesforceRecordId,
        salesforce_record_url: outcome.salesforceRecordUrl,
        submitted_at: now().toISOString(),
        error_type: null,
        error_message: null,
        http_status: outcome.httpStatus,
      }
    : {
        status: outcome.status === "retryable" ? "RETRYABLE" : "FAILED",
        error_type: outcome.errorType,
        error_message: outcome.message,
        http_status: outcome.httpStatus ?? null,
      };

  let row: SubmissionRow;
  try {
    row = await deps.store.complete(request.admissionId, completion);
  } catch {
    // Salesforce outcome is authoritative even if the status write fails.
    row = { ...claim.row, ...completion } as SubmissionRow;
    log({ event: "status_write_failed", admissionId: request.admissionId });
  }

  log({
    event: outcome.success ? "submitted" : "submission_failed",
    admissionId: request.admissionId,
    salesforceRecordId: outcome.success ? outcome.salesforceRecordId : undefined,
    httpStatus: outcome.httpStatus,
    errorType: outcome.success ? undefined : outcome.errorType,
    attemptCount: row.attempt_count,
    at: now().toISOString(),
  });

  if (outcome.success) {
    return {
      httpStatus: 201,
      body: { success: true, status: "submitted", ...fromRow(row) },
    };
  }
  return {
    httpStatus: outcome.status === "retryable" ? 503 : 502,
    body: {
      success: false,
      status: outcome.status,
      errorType: outcome.errorType,
      message: outcome.message,
      ...fromRow(row),
    },
  };
}
