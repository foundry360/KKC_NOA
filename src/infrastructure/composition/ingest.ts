import {
  InMemoryAdmissionEventRepository,
  InMemoryAuditPort,
  InMemoryEventRepository,
} from "@/src/infrastructure/memory";
import {
  InMemoryContractRepository,
  InMemoryDestinationRepository,
  InMemoryTransformationRepository,
} from "@/src/infrastructure/memory/contract-repositories";
import { InMemoryDecisionRepository } from "@/src/infrastructure/memory/decision-repository";
import {
  InMemoryDeadLetterRepository,
  InMemoryDeliveryAttemptRepository,
  InMemoryNotificationRepository,
} from "@/src/infrastructure/memory/delivery-repositories";
import { InMemoryRuleExecutionRepository } from "@/src/infrastructure/memory/rule-execution-repository";
import { InMemoryRuleRepository } from "@/src/infrastructure/memory/rule-repository";
import { InMemoryRoutingSelectionRepository } from "@/src/infrastructure/memory/routing-selection-repository";
import { InMemoryTransformationResultRepository } from "@/src/infrastructure/memory/transformation-result-repository";
import {
  DEFAULT_NOA_CONTRACT_BUSINESS_ID,
  SEED_CONTRACTS,
  SEED_DESTINATIONS,
} from "@/src/infrastructure/seed/contracts";
import { createSeedTransformations } from "@/src/infrastructure/seed/transformations";
import { createSeedRuleVersions } from "@/src/infrastructure/seed/rules";
import { MockDeliveryAdapter } from "@/src/adapters/mock/mock-delivery-adapter";
import { RestDeliveryAdapter } from "@/src/adapters/rest/rest-delivery-adapter";
import { SalesforceDeliveryAdapter } from "@/src/adapters/salesforce/salesforce-delivery-adapter";
import { PegaDeliveryAdapter } from "@/src/adapters/pega/pega-delivery-adapter";
import { DefaultDeliveryAdapterRegistry } from "@/src/adapters/registry";
import { DecisioningService } from "@/src/services/decisioning/decisioning-service";
import { ConfigurableRulesEngine } from "@/src/services/decisioning/rules-engine";
import { DefaultDeliveryService } from "@/src/services/delivery/delivery-service";
import { AdmissionFhirValidator } from "@/src/services/fhir/validator";
import { FhirIngestionService } from "@/src/services/fhir/ingestion-service";
import { AdmissionNormalizationService } from "@/src/services/normalization/normalize-admission";
import { DefaultNoaPipeline } from "@/src/services/pipeline/noa-pipeline";
import { DefaultContractRegistry } from "@/src/services/routing/contract-registry";
import { RoutingService } from "@/src/services/routing/routing-service";
import { SimpleMappingTransformationEngine } from "@/src/services/transformation/mapping-engine";
import { TransformationService } from "@/src/services/transformation/transformation-service";
import { SystemClock } from "@/src/utils/clock";
import { DefaultIdGenerator } from "@/src/utils/id-generator";
import { ConsoleLogger } from "@/src/utils/logger";

export type IngestRuntime = {
  pipeline: DefaultNoaPipeline;
  ingestion: FhirIngestionService;
  decisioning: DecisioningService;
  routing: RoutingService;
  transformation: TransformationService;
  delivery: DefaultDeliveryService;
  events: InMemoryEventRepository;
  admissions: InMemoryAdmissionEventRepository;
  audit: InMemoryAuditPort;
  decisions: InMemoryDecisionRepository;
  rules: InMemoryRuleRepository;
  executions: InMemoryRuleExecutionRepository;
  contracts: InMemoryContractRepository;
  destinations: InMemoryDestinationRepository;
  transformations: InMemoryTransformationRepository;
  selections: InMemoryRoutingSelectionRepository;
  transformResults: InMemoryTransformationResultRepository;
  notifications: InMemoryNotificationRepository;
  attempts: InMemoryDeliveryAttemptRepository;
  deadLetters: InMemoryDeadLetterRepository;
};

/** Bump when singleton shape changes so Next.js HMR does not reuse a stale store. */
const RUNTIME_VERSION = 9;

const globalStore = globalThis as typeof globalThis & {
  __noaIngestRuntime?: IngestRuntime;
  __noaRuntimeVersion?: number;
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

  const destinations = new InMemoryDestinationRepository();
  destinations.seed(SEED_DESTINATIONS);
  const contracts = new InMemoryContractRepository();
  contracts.seed(SEED_CONTRACTS);
  const transformations = new InMemoryTransformationRepository();
  transformations.seed(createSeedTransformations());
  const selections = new InMemoryRoutingSelectionRepository();
  const transformResults = new InMemoryTransformationResultRepository();
  const notifications = new InMemoryNotificationRepository();
  const attempts = new InMemoryDeliveryAttemptRepository();
  const deadLetters = new InMemoryDeadLetterRepository();

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

  const registry = new DefaultContractRegistry(
    contracts,
    destinations,
    transformations,
    process.env.DEFAULT_NOA_CONTRACT ?? DEFAULT_NOA_CONTRACT_BUSINESS_ID
  );

  const routing = new RoutingService({
    clock,
    logger,
    registry,
    events,
    selections,
    audit,
  });

  const transformation = new TransformationService({
    clock,
    logger,
    engine: new SimpleMappingTransformationEngine(),
    events,
    results: transformResults,
    audit,
  });

  const adapters = new DefaultDeliveryAdapterRegistry();
  const mockAdapter = new MockDeliveryAdapter();
  adapters.register(mockAdapter);
  adapters.register(new RestDeliveryAdapter());
  adapters.register(new SalesforceDeliveryAdapter(mockAdapter));
  adapters.register(new PegaDeliveryAdapter(mockAdapter));

  const delivery = new DefaultDeliveryService({
    clock,
    logger,
    adapters,
    events,
    notifications,
    attempts,
    deadLetters,
    audit,
  });

  const pipeline = new DefaultNoaPipeline(
    ingestion,
    decisioning,
    routing,
    transformation,
    delivery
  );

  return {
    pipeline,
    ingestion,
    decisioning,
    routing,
    transformation,
    delivery,
    events,
    admissions,
    audit,
    decisions,
    rules,
    executions,
    contracts,
    destinations,
    transformations,
    selections,
    transformResults,
    notifications,
    attempts,
    deadLetters,
  };
}

export function getIngestRuntime(): IngestRuntime {
  const existing = globalStore.__noaIngestRuntime;
  const stale =
    !existing ||
    globalStore.__noaRuntimeVersion !== RUNTIME_VERSION ||
    typeof existing.audit.listRecent !== "function";

  if (stale) {
    globalStore.__noaIngestRuntime = createIngestRuntime();
    globalStore.__noaRuntimeVersion = RUNTIME_VERSION;
  }
  return globalStore.__noaIngestRuntime!;
}

export function setIngestRuntime(runtime: IngestRuntime | undefined): void {
  globalStore.__noaIngestRuntime = runtime;
  globalStore.__noaRuntimeVersion = runtime ? RUNTIME_VERSION : undefined;
}
