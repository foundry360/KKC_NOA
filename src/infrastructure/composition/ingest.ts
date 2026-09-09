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
import { createSupabaseServiceClient } from "@/src/infrastructure/supabase/client";
import {
  createSupabaseStores,
  type RuntimeStores,
} from "@/src/infrastructure/supabase/stores";
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
  persistence: "memory" | "supabase";
} & RuntimeStores;

/** Bump when singleton shape changes so Next.js HMR does not reuse a stale store. */
const RUNTIME_VERSION = 10;

const globalStore = globalThis as typeof globalThis & {
  __noaIngestRuntime?: IngestRuntime;
  __noaRuntimeVersion?: number;
  __noaRuntimeInit?: Promise<IngestRuntime>;
};

function createMemoryStores(): RuntimeStores {
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

  return {
    events,
    admissions,
    audit,
    decisions,
    executions,
    rules,
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

function wireRuntime(
  stores: RuntimeStores,
  persistence: "memory" | "supabase"
): IngestRuntime {
  const clock = new SystemClock();
  const logger = new ConsoleLogger("fhir-noa");
  const ids = new DefaultIdGenerator(clock);

  const ingestion = new FhirIngestionService({
    ids,
    clock,
    logger,
    events: stores.events,
    admissions: stores.admissions,
    audit: stores.audit,
    validator: new AdmissionFhirValidator(),
    normalizer: new AdmissionNormalizationService(),
  });

  const decisioning = new DecisioningService({
    clock,
    logger,
    rulesEngine: new ConfigurableRulesEngine(stores.rules),
    events: stores.events,
    decisions: stores.decisions,
    executions: stores.executions,
    audit: stores.audit,
  });

  const registry = new DefaultContractRegistry(
    stores.contracts,
    stores.destinations,
    stores.transformations,
    process.env.DEFAULT_NOA_CONTRACT ?? DEFAULT_NOA_CONTRACT_BUSINESS_ID
  );

  const routing = new RoutingService({
    clock,
    logger,
    registry,
    events: stores.events,
    selections: stores.selections,
    audit: stores.audit,
  });

  const transformation = new TransformationService({
    clock,
    logger,
    engine: new SimpleMappingTransformationEngine(),
    events: stores.events,
    results: stores.transformResults,
    audit: stores.audit,
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
    events: stores.events,
    notifications: stores.notifications,
    attempts: stores.attempts,
    deadLetters: stores.deadLetters,
    audit: stores.audit,
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
    persistence,
    ...stores,
  };
}

/** Prefer Supabase service role when configured; otherwise process-local memory. */
export async function createIngestRuntime(): Promise<IngestRuntime> {
  const client = createSupabaseServiceClient();
  if (client) {
    const stores = await createSupabaseStores(client);
    return wireRuntime(stores, "supabase");
  }
  return wireRuntime(createMemoryStores(), "memory");
}

/** Sync memory-only factory for unit/integration tests that must not hit Supabase. */
export function createMemoryIngestRuntime(): IngestRuntime {
  return wireRuntime(createMemoryStores(), "memory");
}

export async function getIngestRuntime(): Promise<IngestRuntime> {
  const existing = globalStore.__noaIngestRuntime;
  const stale =
    !existing ||
    globalStore.__noaRuntimeVersion !== RUNTIME_VERSION ||
    typeof existing.audit.listRecent !== "function";

  if (!stale) {
    return existing;
  }

  if (!globalStore.__noaRuntimeInit) {
    globalStore.__noaRuntimeInit = createIngestRuntime()
      .then((runtime) => {
        globalStore.__noaIngestRuntime = runtime;
        globalStore.__noaRuntimeVersion = RUNTIME_VERSION;
        return runtime;
      })
      .finally(() => {
        globalStore.__noaRuntimeInit = undefined;
      });
  }

  return globalStore.__noaRuntimeInit;
}

export function setIngestRuntime(runtime: IngestRuntime | undefined): void {
  globalStore.__noaIngestRuntime = runtime;
  globalStore.__noaRuntimeVersion = runtime ? RUNTIME_VERSION : undefined;
  globalStore.__noaRuntimeInit = undefined;
}
