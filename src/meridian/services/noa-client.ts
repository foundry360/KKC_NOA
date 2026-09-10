import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export type NoaSendResult = {
  ok: boolean;
  demoMode: boolean;
  correlationId: string;
  eventId?: string;
  processingState?: string;
  decision?: string;
  adapterKey?: string;
  acknowledgement?: { acknowledgedAt?: string; ackId?: string };
  error?: string;
  timeline: Array<{
    step: string;
    status: "pending" | "done" | "failed";
    at?: string;
  }>;
};

function forceDemoMode(): boolean {
  return process.env.MERIDIAN_DEMO_MODE === "true";
}

function configuredExternalUrl(): string | null {
  const configured = process.env.NOA_ACCELERATOR_URL?.trim();
  return configured ? configured.replace(/\/$/, "") : null;
}

function buildDemoTimeline(now: string): NoaSendResult["timeline"] {
  return [
    { step: "Admission Created", status: "done", at: now },
    { step: "FHIR Event Generated", status: "done", at: now },
    { step: "FHIR Sent", status: "done", at: now },
    { step: "NOA Accelerator", status: "done", at: now },
    { step: "Rules Evaluated", status: "done", at: now },
    { step: "NOA Required", status: "done", at: now },
    { step: "Payer Contract Selected", status: "done", at: now },
    { step: "Notification Delivered", status: "done", at: now },
    { step: "Payer Acknowledgement", status: "done", at: now },
  ];
}

function timelineFromNoa(state: string, now: string): NoaSendResult["timeline"] {
  const steps = [
    "Admission Created",
    "FHIR Event Generated",
    "FHIR Sent",
    "NOA Accelerator",
    "Rules Evaluated",
    "NOA Required",
    "Payer Contract Selected",
    "Notification Delivered",
    "Payer Acknowledgement",
  ];
  const rank: Record<string, number> = {
    RECEIVED: 3,
    VALIDATED: 3,
    NORMALIZED: 3,
    EVALUATED: 5,
    ROUTED: 6,
    TRANSFORMED: 6,
    DELIVERED: 7,
    ACKNOWLEDGED: 8,
    NO_NOA_REQUIRED: 5,
    NO_CONTRACT: 5,
    VALIDATION_FAILED: 3,
    DELIVERY_FAILED: 7,
    DEAD_LETTER: 7,
  };
  const doneThrough = rank[state] ?? 3;
  return steps.map((step, i) => ({
    step,
    status:
      state.includes("FAILED") && i >= doneThrough
        ? i === doneThrough
          ? "failed"
          : "pending"
        : i <= doneThrough
          ? "done"
          : "pending",
    at: i <= doneThrough ? now : undefined,
  }));
}

function demoResult(
  now: string,
  correlationId: string,
  reason?: string
): NoaSendResult {
  return {
    ok: true,
    demoMode: true,
    correlationId,
    eventId: `demo-${Date.now()}`,
    processingState: "ACKNOWLEDGED",
    decision: "SEND_NOA",
    adapterKey: "mock",
    acknowledgement: {
      acknowledgedAt: now,
      ackId: `ACK-DEMO-${Date.now().toString(16).toUpperCase()}`,
    },
    error: reason,
    timeline: buildDemoTimeline(now),
  };
}

/**
 * EHR → NOA Accelerator only. Prefers in-process pipeline when no external URL
 * is configured (same Next.js deployment). No Salesforce/Pega awareness.
 */
export async function sendFhirAdmissionEvent(
  bundle: unknown,
  options?: {
    correlationId?: string;
    contractBusinessId?: string;
    sourceSystem?: string;
  }
): Promise<NoaSendResult> {
  const now = new Date().toISOString();
  const day = now.slice(0, 10).replace(/-/g, "");
  const fallbackCorrelation = `NOA-${day}-${String(
    Math.floor(Math.random() * 1_000_000)
  ).padStart(6, "0")}`;
  const correlationId = options?.correlationId ?? fallbackCorrelation;

  if (forceDemoMode()) {
    return demoResult(now, correlationId, "MERIDIAN_DEMO_MODE=true");
  }

  const external = configuredExternalUrl();

  if (!external) {
    try {
      const { pipeline } = await getIngestRuntime();
      const result = await pipeline.process({
        rawBody: bundle,
        contentType: "application/fhir+json",
        correlationId,
        sourceSystem: options?.sourceSystem ?? "MERIDIAN_CLINICAL",
        contractBusinessId: options?.contractBusinessId,
      });
      return {
        ok: true,
        demoMode: false,
        correlationId: result.correlationId,
        eventId: result.eventId,
        processingState: result.processingState,
        decision: result.decision?.decision,
        adapterKey: result.delivery?.adapterKey,
        acknowledgement: result.acknowledgement ?? result.delivery?.acknowledgement,
        timeline: timelineFromNoa(result.processingState, now),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "In-process NOA failed";
      return demoResult(now, correlationId, `Demo Mode: ${message}`);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/fhir+json",
    Accept: "application/json",
    "X-Source-System": options?.sourceSystem ?? "MERIDIAN_CLINICAL",
    "X-Correlation-Id": correlationId,
  };
  const apiKey = process.env.FHIR_INGEST_API_KEY;
  if (apiKey) headers["X-API-Key"] = apiKey;
  if (options?.contractBusinessId) {
    headers["X-Contract-Id"] = options.contractBusinessId;
  }

  try {
    const res = await fetch(external, {
      method: "POST",
      headers,
      body: JSON.stringify(bundle),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      const err =
        typeof body.error === "object" && body.error && "message" in body.error
          ? String((body.error as { message: string }).message)
          : `HTTP ${res.status}`;
      return {
        ok: false,
        demoMode: false,
        correlationId:
          (typeof body.correlationId === "string" && body.correlationId) ||
          correlationId,
        error: err,
        processingState:
          typeof body.processingState === "string"
            ? body.processingState
            : "VALIDATION_FAILED",
        timeline: timelineFromNoa("VALIDATION_FAILED", now),
      };
    }

    const processingState =
      typeof body.processingState === "string"
        ? body.processingState
        : "RECEIVED";
    const delivery =
      typeof body.delivery === "object" && body.delivery
        ? (body.delivery as Record<string, unknown>)
        : undefined;
    const ack =
      typeof delivery?.acknowledgement === "object" && delivery.acknowledgement
        ? (delivery.acknowledgement as Record<string, unknown>)
        : typeof body.acknowledgement === "object" && body.acknowledgement
          ? (body.acknowledgement as Record<string, unknown>)
          : undefined;

    return {
      ok: true,
      demoMode: false,
      correlationId:
        (typeof body.correlationId === "string" && body.correlationId) ||
        correlationId,
      eventId: typeof body.eventId === "string" ? body.eventId : undefined,
      processingState,
      decision:
        typeof body.decision === "object" &&
        body.decision &&
        "decision" in (body.decision as object)
          ? String((body.decision as { decision: string }).decision)
          : undefined,
      adapterKey:
        typeof delivery?.adapterKey === "string"
          ? delivery.adapterKey
          : undefined,
      acknowledgement: ack
        ? {
            acknowledgedAt:
              typeof ack.acknowledgedAt === "string"
                ? ack.acknowledgedAt
                : undefined,
            ackId: typeof ack.ackId === "string" ? ack.ackId : undefined,
          }
        : undefined,
      timeline: timelineFromNoa(processingState, now),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Accelerator unreachable";
    return demoResult(now, correlationId, `Demo Mode: ${message}`);
  }
}
