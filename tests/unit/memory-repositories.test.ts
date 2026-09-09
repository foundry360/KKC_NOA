import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryEventRepository } from "@/src/infrastructure/memory/event-repository";
import { InMemoryAdmissionEventRepository } from "@/src/infrastructure/memory/admission-event-repository";
import { InMemoryAuditPort } from "@/src/infrastructure/memory/audit-port";
import type { InboundEvent } from "@/src/domain/events/inbound-event";
import type { AdmissionEvent } from "@/src/domain/admission/admission-event";

describe("In-memory repositories", () => {
  const events = new InMemoryEventRepository();
  const admissions = new InMemoryAdmissionEventRepository();
  const audit = new InMemoryAuditPort();

  beforeEach(() => {
    events.clear();
    admissions.clear();
    audit.clear();
  });

  it("saves and updates event processing state", async () => {
    const event: InboundEvent = {
      id: "00000000-0000-4000-8000-000000000001",
      correlationId: "NOA-20260909-000001",
      eventType: "ADMISSION",
      receivedAt: "2026-09-09T18:00:00.000Z",
      contentType: "application/fhir+json",
      processingState: "RECEIVED",
      rawPayload: { resourceType: "Bundle" },
    };

    await events.save(event);
    await events.updateState(event.id, "VALIDATED");

    const found = await events.findByCorrelationId("NOA-20260909-000001");
    expect(found?.processingState).toBe("VALIDATED");
  });

  it("stores canonical admission events by eventId", async () => {
    const admission: AdmissionEvent = {
      eventId: "00000000-0000-4000-8000-000000000001",
      correlationId: "NOA-20260909-000001",
      sourceSystem: "SYNTHETIC_EHR",
      eventType: "ADMISSION",
      eventTimestamp: "2026-09-09T14:30:00.000Z",
      patient: { name: { family: "SYNTHETIC", given: ["ADA"] } },
      encounter: { class: "INPATIENT" },
      admission: { admissionDateTime: "2026-09-09T14:30:00.000Z" },
      facility: { name: "Synthetic General Hospital" },
      payer: { payerType: "MEDICARE", name: "Synthetic Medicare" },
      coverage: { status: "active" },
      diagnoses: [],
      providers: [],
      sourceMetadata: {},
    };

    await admissions.save(admission);
    const found = await admissions.findByEventId(admission.eventId);
    expect(found?.payer.payerType).toBe("MEDICARE");
    expect(found?.encounter.class).toBe("INPATIENT");
  });

  it("records audit entries in chronological order", async () => {
    await audit.record({
      correlationId: "NOA-20260909-000001",
      eventId: "e1",
      timestamp: "2026-09-09T18:00:01.000Z",
      component: "listener",
      action: "EVENT_RECEIVED",
      status: "SUCCESS",
    });
    await audit.record({
      correlationId: "NOA-20260909-000001",
      eventId: "e1",
      timestamp: "2026-09-09T18:00:00.000Z",
      component: "listener",
      action: "REQUEST_ACCEPTED",
      status: "INFO",
    });

    const list = await audit.listByCorrelationId("NOA-20260909-000001");
    expect(list.map((e) => e.action)).toEqual([
      "REQUEST_ACCEPTED",
      "EVENT_RECEIVED",
    ]);
  });
});
