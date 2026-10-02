import type { SubmissionResponseBody } from "@/supabase/functions/submit-admission-to-salesforce/salesforce";

export const SALESFORCE_FUNCTION_NAME = "submit-admission-to-salesforce";
const REQUEST_TIMEOUT_MS = 45_000;

export type SalesforceSubmitResponse = SubmissionResponseBody & {
  httpStatus?: number;
};

function resolveEndpoint(): { url: string; key: string } | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const explicit = process.env.SALESFORCE_SUBMIT_FUNCTION_URL;
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key) return null;
  if (explicit) return { url: explicit, key };
  if (!base) return null;
  return {
    url: `${base.replace(/\/+$/, "")}/functions/v1/${SALESFORCE_FUNCTION_NAME}`,
    key,
  };
}

/**
 * Server-side call to the Supabase Edge Function. Salesforce credentials and
 * tokens never pass through Meridian; the browser never sees this request.
 */
export async function submitAdmissionPayload(input: {
  admissionId: string;
  payload: string;
}): Promise<SalesforceSubmitResponse> {
  const endpoint = resolveEndpoint();
  if (!endpoint) {
    return {
      success: false,
      status: "failed",
      errorType: "CONFIGURATION",
      message: "Salesforce integration is not configured.",
    };
  }

  let res: Response;
  try {
    res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: endpoint.key,
        Authorization: `Bearer ${endpoint.key}`,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return {
      success: false,
      status: "retryable",
      errorType: "SALESFORCE_CONNECTION",
      message: "Could not reach the Salesforce integration service. Please retry.",
    };
  }

  let body: Partial<SubmissionResponseBody> | null = null;
  try {
    body = (await res.json()) as Partial<SubmissionResponseBody>;
  } catch {
    body = null;
  }

  if (body && typeof body.success === "boolean" && typeof body.status === "string") {
    return { ...(body as SubmissionResponseBody), httpStatus: res.status };
  }

  if (res.status === 404) {
    return {
      success: false,
      status: "failed",
      errorType: "CONFIGURATION",
      message: "Salesforce integration function is not deployed.",
      httpStatus: res.status,
    };
  }
  if (res.status === 401 || res.status === 403) {
    return {
      success: false,
      status: "failed",
      errorType: "CONFIGURATION",
      message: "Meridian is not authorized to call the Salesforce integration service.",
      httpStatus: res.status,
    };
  }
  return {
    success: false,
    status: "retryable",
    errorType: "SALESFORCE_CONNECTION",
    message: "Salesforce submission failed. Please retry.",
    httpStatus: res.status,
  };
}
