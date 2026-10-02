import type { AdapterKey, UUID } from "../types";
import type {
  AuthorizationRequirement,
  ContractProfileSourceType,
  NotificationRequirement,
  NotificationWindow,
  TransformKind,
} from "../payer-requirements/types";

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number[];
  deadLetterAfterMax: boolean;
}

export interface DestinationConfig {
  id: UUID;
  code: string;
  name: string;
  adapterKey: AdapterKey | string;
  endpoint?: string;
  authType?: string;
  /** Env var *names* only — never secret values. */
  authConfig?: Record<string, string>;
  active: boolean;
  /** Test/demo knobs for mock adapter failure simulation */
  simulation?: {
    failAttempts?: number;
    statusCode?: number;
    timeout?: boolean;
  };
}

/** Operational HOW profile derived from published requirements or a real contract. */
export interface ContractProfileMeta {
  sourceType: ContractProfileSourceType;
  payerBrand?: string;
  planProduct?: string;
  state?: string;
  providerFacility?: string;
  network?: string;
  transactionType?: string;
  notificationRequirement?: NotificationRequirement;
  authorizationRequirement?: AuthorizationRequirement;
  notificationWindow?: NotificationWindow | "UNKNOWN";
  submissionChannels?: string[];
  acknowledgementBehavior?: string;
  transformKind?: TransformKind;
  sourceReference?: {
    requirementIds?: string[];
    source?: string;
    sourceUrl?: string;
    verificationDate?: string;
    evidence?: string;
  };
}

export interface ContractVersionRecord {
  id: UUID;
  contractBusinessId: string;
  name: string;
  version: number;
  /** Payer type dimension: MEDICARE | COMMERCIAL | MEDICAID */
  payer?: string;
  product?: string;
  /** Brand / legal payer name for specificity matching (e.g. Aetna). */
  payerBrand?: string;
  planProduct?: string;
  state?: string;
  facilityId?: string;
  network?: string;
  payloadFormat: string;
  transport: string;
  destinationId: UUID;
  transformerCode: string;
  acknowledgementType: string;
  retryPolicy: RetryPolicy;
  requiredFields: string[];
  effectiveDate: string;
  expirationDate?: string | null;
  active: boolean;
  profile?: ContractProfileMeta;
}

export interface ContractSelectionInput {
  notificationType?: string;
  payerType?: string;
  /** Payer brand / Organization.name from coverage */
  payer?: string;
  product?: string;
  state?: string;
  encounterClass?: string;
  facilityId?: string;
  network?: string;
  planProduct?: string;
  /** Demo override: force a specific contract business id */
  contractBusinessId?: string;
  asOf: Date;
}
