import {
  InMemoryAdmissionEventRepository,
  InMemoryAuditPort,
  InMemoryEventRepository,
} from "@/src/infrastructure/memory";
import { InMemoryDecisionRepository } from "@/src/infrastructure/memory/decision-repository";
import { InMemoryRuleExecutionRepository } from "@/src/infrastructure/memory/rule-execution-repository";
import { InMemoryRuleRepository } from "@/src/infrastructure/memory/rule-repository";
import { createSeedRuleVersions } from "@/src/infrastructure/seed/rules";
import { DecisioningService } from "@/src/services/decisioning/decisioning-service";
import { ConfigurableRulesEngine } from "@/src/services/decisioning/rules-engine";
import { AdmissionFhirValidator } from "@/src/services/fhir/validator";
import { FhirIngestionService } from "@/src/services/fhir/ingestion-service";
import { AdmissionNormalizationService } from "@/src/services/normalization/normalize-admission";
import { DefaultNoaPipeline } from "@/src/services/pipeline/noa-pipeline";
import { SystemClock } from "@/src/utils/clock";
import { DefaultIdGenerator } from "@/src/utils/id-generator";
import { ConsoleLogger } from "@/src/utils/logger";

/**
 * Process-local composition for POC when Supabase is not configured.
 * Domain services depend on ports; this module wires concrete adapters.
 */
export type IngestRuntime = {
  pipeline: DefaultNoaPipeline;
  ingestion: FhirIngestionService;
  decisioning: DecisioningService;
  events: InMemoryEventRepository;
  admissions: InMemoryAdmissionEventRepository;
  audit: InMemoryAuditPort;
  decisions: InMemoryDecisionRepository;
  rules: InMemoryRuleRepository;
  executions: InMemoryRuleExecutionRepository;
};

const globalStore = globalThis as typeof globalThis & {
  __noaIngestRuntime?: IngestRuntime;
};

export function createIngestRuntime(): IngestRuntime {
  const clock = new SystemClock();
  const events = new InMemoryEventRepository();
  const admissions = new InMemoryAdmissionEventRepository();
  const audit = new InMemoryAuditPort();
  const decisions = new InMemoryDecisionRepository();
  const executions = new InMemoryRuleExecutionRepository();
  const rules = new InMemoryRuleRepository();
  rules.seed(createSeedRuleVersions());

  const logger = new ConsoleLogger("fhir-noa");
  const ids = new DefaultIdGenerator(clock);

  const ingestion = new FhirIngestionService({
    ids,
    clock,
    logger,
    events,
    admissions,
    audit,
    validator: new AdmissionFhirValidator(),
    normalizer: new AdmissionNormalizationService(),
  });

  const decisioning = new DecisioningService({
    clock,
    logger,
    rulesEngine: new ConfigurableRulesEngine(rules),
    events,
    decisions,
    executions,
    audit,
  });

  const pipeline = new DefaultNoaPipeline(ingestion, decisioning);

  return {
    pipeline,
    ingestion,
    decisioning,
    events,
    admissions,
    audit,
    decisions,
    rules,
    executions,
  };
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
