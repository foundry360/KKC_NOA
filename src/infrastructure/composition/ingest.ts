import {
  InMemoryAdmissionEventRepository,
  InMemoryAuditPort,
  InMemoryEventRepository,
} from "@/src/infrastructure/memory";
import { AdmissionFhirValidator } from "@/src/services/fhir/validator";
import { FhirIngestionService } from "@/src/services/fhir/ingestion-service";
import { AdmissionNormalizationService } from "@/src/services/normalization/normalize-admission";
import { SystemClock } from "@/src/utils/clock";
import { DefaultIdGenerator } from "@/src/utils/id-generator";
import { ConsoleLogger } from "@/src/utils/logger";

/**
 * Process-local composition for POC when Supabase is not configured.
 * Domain services depend on ports; this module wires concrete adapters.
 */
export type IngestRuntime = {
  ingestion: FhirIngestionService;
  events: InMemoryEventRepository;
  admissions: InMemoryAdmissionEventRepository;
  audit: InMemoryAuditPort;
};

const globalStore = globalThis as typeof globalThis & {
  __noaIngestRuntime?: IngestRuntime;
};

export function createIngestRuntime(): IngestRuntime {
  const clock = new SystemClock();
  const events = new InMemoryEventRepository();
  const admissions = new InMemoryAdmissionEventRepository();
  const audit = new InMemoryAuditPort();

  const ingestion = new FhirIngestionService({
    ids: new DefaultIdGenerator(clock),
    clock,
    logger: new ConsoleLogger("fhir-ingest"),
    events,
    admissions,
    audit,
    validator: new AdmissionFhirValidator(),
    normalizer: new AdmissionNormalizationService(),
  });

  return { ingestion, events, admissions, audit };
}

export function getIngestRuntime(): IngestRuntime {
  if (!globalStore.__noaIngestRuntime) {
    globalStore.__noaIngestRuntime = createIngestRuntime();
  }
  return globalStore.__noaIngestRuntime;
}

/** Test helper — replace the singleton. */
export function setIngestRuntime(runtime: IngestRuntime | undefined): void {
  globalStore.__noaIngestRuntime = runtime;
}
