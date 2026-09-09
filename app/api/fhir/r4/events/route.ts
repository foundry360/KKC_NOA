import { NextRequest, NextResponse } from "next/server";
import { isAppError } from "@/src/domain/errors/app-error";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";
import { getFhirIngestApiKey } from "@/src/utils/env";

function unauthorized(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Valid API key required",
      },
    },
    { status: 401 }
  );
}

function extractApiKey(request: NextRequest): string | undefined {
  const headerKey = request.headers.get("x-api-key") ?? undefined;
  if (headerKey) return headerKey;

  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return undefined;
}

function assertAuthorized(request: NextRequest): NextResponse | null {
  const expected = getFhirIngestApiKey();
  if (!expected) {
    return null;
  }
  const provided = extractApiKey(request);
  if (!provided || provided !== expected) {
    return unauthorized();
  }
  return null;
}

export async function GET() {
  return NextResponse.json({
    service: "fhir-noa-accelerator",
    endpoint: "/api/fhir/r4/events",
    status: "ready",
    accepts: ["application/fhir+json", "application/json"],
    pipelineThrough: "EVALUATED",
  });
}

export async function POST(request: NextRequest) {
  const authError = assertAuthorized(request);
  if (authError) return authError;

  const contentType = request.headers.get("content-type") ?? "";
  const correlationHeader = request.headers.get("x-correlation-id") ?? undefined;
  const sourceSystem = request.headers.get("x-source-system") ?? undefined;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON",
        },
      },
      { status: 400 }
    );
  }

  try {
    const { pipeline, admissions } = getIngestRuntime();
    const result = await pipeline.process({
      rawBody,
      contentType,
      correlationId: correlationHeader,
      sourceSystem,
    });

    const admission = await admissions.findByEventId(result.eventId);

    const body = {
      eventId: result.eventId,
      correlationId: result.correlationId,
      processingState: result.processingState,
      eventType: "ADMISSION",
      ...(admission
        ? {
            admissionEvent: {
              encounterClass: admission.encounter.class,
              payerType: admission.payer.payerType,
              admissionDateTime: admission.admission.admissionDateTime,
              facilityName: admission.facility.name,
            },
          }
        : {}),
      ...(result.decision
        ? {
            decision: {
              decision: result.decision.decision,
              notificationRequired: result.decision.notificationRequired,
              notificationType: result.decision.notificationType,
              priority: result.decision.priority,
              rulesApplied: result.decision.rulesApplied,
              ruleVersions: result.decision.ruleVersions,
            },
          }
        : {}),
      ...(result.errors ? { errors: result.errors } : {}),
    };

    if (result.processingState === "VALIDATION_FAILED") {
      return NextResponse.json(body, {
        status: 422,
        headers: { "X-Correlation-Id": result.correlationId },
      });
    }

    if (result.processingState === "RULE_REJECTED") {
      return NextResponse.json(body, {
        status: 200,
        headers: { "X-Correlation-Id": result.correlationId },
      });
    }

    return NextResponse.json(body, {
      status: 202,
      headers: { "X-Correlation-Id": result.correlationId },
    });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected ingest failure",
        },
      },
      { status: 500 }
    );
  }
}
