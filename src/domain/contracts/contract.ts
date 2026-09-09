import type { AdapterKey, UUID } from "../types";

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

export interface ContractVersionRecord {
  id: UUID;
  contractBusinessId: string;
  name: string;
  version: number;
  payer?: string;
  product?: string;
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
}

export interface ContractSelectionInput {
  notificationType?: string;
  payerType?: string;
  payer?: string;
  product?: string;
  state?: string;
  encounterClass?: string;
  /** Demo override: force a specific contract business id */
  contractBusinessId?: string;
  asOf: Date;
}
