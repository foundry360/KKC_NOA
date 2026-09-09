import type {
  ContractVersionRecord,
  DestinationConfig,
  RetryPolicy,
} from "@/src/domain/contracts/contract";

const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: [1000, 5000, 15000],
  deadLetterAfterMax: true,
};

export const SEED_DESTINATIONS: DestinationConfig[] = [
  {
    id: "22222222-2222-4222-8222-222222222001",
    code: "MOCK_PAYER",
    name: "Mock Payer Endpoint",
    adapterKey: "mock",
    endpoint: "mock://payer/noa",
    authType: "NONE",
    active: true,
  },
  {
    id: "22222222-2222-4222-8222-222222222002",
    code: "SF_NOA_INBOX",
    name: "Salesforce NOA Inbox (mock)",
    adapterKey: "salesforce",
    endpoint: "mock://salesforce/noa",
    authType: "OAUTH2",
    authConfig: { clientIdEnv: "SALESFORCE_CLIENT_ID" },
    active: true,
  },
  {
    id: "22222222-2222-4222-8222-222222222003",
    code: "PEGA_NOA_CASE",
    name: "Pega NOA Case (mock)",
    adapterKey: "pega",
    endpoint: "mock://pega/noa",
    authType: "API_KEY",
    authConfig: { apiKeyEnv: "PEGA_API_KEY" },
    active: true,
  },
];

export const SEED_CONTRACTS: ContractVersionRecord[] = [
  {
    id: "44444444-4444-4444-8444-444444444001",
    contractBusinessId: "MEDICARE_NOA_MOCK_V1",
    name: "Medicare NOA → Mock Payer",
    version: 1,
    payer: "MEDICARE",
    product: "NOA",
    payloadFormat: "JSON",
    transport: "REST",
    destinationId: "22222222-2222-4222-8222-222222222001",
    transformerCode: "MEDICARE_NOA_MOCK_TRANSFORM",
    acknowledgementType: "HTTP_200_BODY",
    retryPolicy: DEFAULT_RETRY,
    requiredFields: [
      "notificationType",
      "admissionDateTime",
      "patient.lastName",
      "correlationId",
    ],
    effectiveDate: "2020-01-01T00:00:00.000Z",
    expirationDate: null,
    active: true,
  },
  {
    id: "44444444-4444-4444-8444-444444444002",
    contractBusinessId: "MEDICARE_NOA_SF_V1",
    name: "Medicare NOA → Salesforce",
    version: 1,
    payer: "MEDICARE",
    product: "NOA",
    payloadFormat: "JSON",
    transport: "REST",
    destinationId: "22222222-2222-4222-8222-222222222002",
    transformerCode: "MEDICARE_NOA_SF_TRANSFORM",
    acknowledgementType: "HTTP_200_BODY",
    retryPolicy: DEFAULT_RETRY,
    requiredFields: [
      "notificationType",
      "admissionDateTime",
      "PatientLastName",
      "correlationId",
    ],
    effectiveDate: "2020-01-01T00:00:00.000Z",
    expirationDate: null,
    active: true,
  },
  {
    id: "44444444-4444-4444-8444-444444444003",
    contractBusinessId: "MEDICARE_NOA_PEGA_V1",
    name: "Medicare NOA → Pega",
    version: 1,
    payer: "MEDICARE",
    product: "NOA",
    payloadFormat: "JSON",
    transport: "REST",
    destinationId: "22222222-2222-4222-8222-222222222003",
    transformerCode: "MEDICARE_NOA_PEGA_TRANSFORM",
    acknowledgementType: "HTTP_200_BODY",
    retryPolicy: DEFAULT_RETRY,
    requiredFields: [
      "notificationType",
      "AdmissionDateTime",
      "MemberLastName",
      "correlationId",
    ],
    effectiveDate: "2020-01-01T00:00:00.000Z",
    expirationDate: null,
    active: true,
  },
];

/** Golden-path default when multiple Medicare contracts match. */
export const DEFAULT_NOA_CONTRACT_BUSINESS_ID = "MEDICARE_NOA_MOCK_V1";
