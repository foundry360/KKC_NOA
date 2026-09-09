import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createMemoryIngestRuntime,
} from "@/src/infrastructure/composition/ingest";
import { FixedClock } from "@/src/utils/clock";
import { SequentialIdGenerator } from "@/src/utils/id-generator";
import { MemoryLogger } from "@/src/utils/logger";
import { FhirIngestionService } from "@/src/services/fhir/ingestion-service";
import { AdmissionFhirValidator } from "@/src/services/fhir/validator";
import { AdmissionNormalizationService } from "@/src/services/normalization/normalize-admission";
import {
  InMemoryAdmissionEventRepository,
  InMemoryAuditPort,
  InMemoryEventRepository,
} from "@/src/infrastructure/memory";
import { ValidationError } from "@/src/domain/errors/app-error";

function loadFixture(name: string): unknown {
  const file = path.join(process.cwd(), "fhir", "fixtures", name);
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("FhirIngestionService integration", () => {
  const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
  let events: InMemoryEventRepository;
  let admissions: InMemoryAdmissionEventRepository;
  let audit: InMemoryAuditPort;
  let ingestion: FhirIngestionService;

  beforeEach(() => {
    events = new InMemoryEventRepository();
    admissions = new InMemoryAdmissionEventRepository();
    audit = new InMemoryAuditPort();
    ingestion = new FhirIngestionService({
      ids: new SequentialIdGenerator(clock),
      clock,
      logger: new MemoryLogger(),
      events,
      admissions,
      audit,
      validator: new AdmissionFhirValidator(),
      normalizer: new AdmissionNormalizationService(),
    });
  });

  it("processes golden-path FHIR → AdmissionEvent through NORMALIZED", async () => {
    const result = await ingestion.ingest({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
      correlationId: "NOA-20260909-000123",
      sourceSystem: "SYNTHETIC_EHR",
    });

    expect(result.processingState).toBe("NORMALIZED");
    expect(result.correlationId).toBe("NOA-20260909-000123");
    expect(result.admissionEvent?.encounter.class).toBe("INPATIENT");
    expect(result.admissionEvent?.payer.payerType).toBe("MEDICARE");

    const storedEvent = await events.findById(result.eventId);
    expect(storedEvent?.processingState).toBe("NORMALIZED");
    expect(storedEvent?.rawPayload).toBeTruthy();

    const storedAdmission = await admissions.findByEventId(result.eventId);
    expect(storedAdmission?.patient.name.family).toBe("SYNTHETIC");

    const trail = await audit.listByCorrelationId(result.correlationId);
    expect(trail.map((e) => e.action)).toEqual([
      "EVENT_RECEIVED",
      "FHIR_VALIDATED",
      "NORMALIZED",
    ]);
    expect(trail.every((e) => e.status === "SUCCESS")).toBe(true);
  });

  it("persists VALIDATION_FAILED without discarding the event", async () => {
    const result = await ingestion.ingest({
      rawBody: loadFixture("admission-invalid-missing-patient.json"),
      contentType: "application/json",
    });

    expect(result.processingState).toBe("VALIDATION_FAILED");
    expect(result.errors?.some((e) => e.code === "MISSING_PATIENT")).toBe(true);

    const stored = await events.findById(result.eventId);
    expect(stored?.processingState).toBe("VALIDATION_FAILED");
    expect(stored?.rawPayload).toBeTruthy();

    const trail = await audit.listByCorrelationId(result.correlationId);
    expect(trail.some((e) => e.action === "EVENT_RECEIVED")).toBe(true);
    expect(
      trail.some((e) => e.action === "FHIR_VALIDATED" && e.status === "FAILURE")
    ).toBe(true);
  });

  it("rejects unsupported content types before persistence", async () => {
    await expect(
      ingestion.ingest({
        rawBody: { resourceType: "Bundle" },
        contentType: "text/plain",
      })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(await events.listRecent(10)).toHaveLength(0);
  });

  it("composition runtime wires a working ingestion service", async () => {
    const runtime = await createMemoryIngestRuntime();
    const result = await runtime.ingestion.ingest({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
    });
    expect(result.processingState).toBe("NORMALIZED");
    expect(runtime.persistence).toBe("memory");
  });
});
