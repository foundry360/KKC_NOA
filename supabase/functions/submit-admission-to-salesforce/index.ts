// Supabase Edge Function: Meridian Clinical admission → Salesforce Admission__c.
// Salesforce credentials are read only from Edge Function secrets.
import {
  createPostgrestSubmissionStore,
  handleSubmissionRequest,
} from "./salesforce.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * The gateway (verify_jwt = true) has already validated the JWT signature;
 * this additionally restricts callers to the service role so the public anon
 * key cannot create Salesforce records.
 */
function isServiceRoleCaller(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return true;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const claims = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return claims?.role === "service_role";
  } catch {
    return false;
  }
}

function log(event: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: "submit-admission-to-salesforce", ...event }));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return respond(405, { success: false, status: "failed", message: "Method not allowed." });
  }
  if (!isServiceRoleCaller(req)) {
    log({ event: "unauthorized_caller" });
    return respond(401, { success: false, status: "failed", message: "Unauthorized." });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respond(400, {
      success: false,
      status: "failed",
      errorType: "VALIDATION",
      message: "Request body must be JSON.",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const result = await handleSubmissionRequest(body, {
    getEnv: (key) => Deno.env.get(key),
    fetchImpl: fetch,
    store: createPostgrestSubmissionStore({
      supabaseUrl,
      serviceRoleKey,
      fetchImpl: fetch,
    }),
    log,
  });

  return respond(result.httpStatus, result.body);
});
