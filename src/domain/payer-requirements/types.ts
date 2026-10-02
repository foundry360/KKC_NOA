/**
 * Configurable payer requirements library (not hard-coded if/else in the engine).
 * Distinguishes published payer requirements from negotiated provider contracts.
 */

export type RequirementSourceType =
  | "PUBLISHED_PAYER_REQUIREMENT"
  | "PROVIDER_PAYER_CONTRACT"
  | "REGULATORY";

export type RequirementStatus = "ACTIVE" | "DRAFT" | "RETIRED";

export type NotificationStartEvent =
  | "ADMISSION_TIME"
  | "EMERGENCY_ADMISSION_TIME"
  | "ORDER_TIME"
  | "ENCOUNTER_CREATION"
  | "OTHER";

export type TimingUnit = "HOURS" | "BUSINESS_DAYS" | "CALENDAR_DAYS";

export interface NotificationWindow {
  value: number;
  unit: TimingUnit;
  startEvent: NotificationStartEvent;
}

export type AuthorizationRequirement =
  | "REQUIRED"
  | "NOT_REQUIRED"
  | "NOT_REQUIRED_FOR_EMERGENCY_SERVICES"
  | "CODE_DEPENDENT"
  | "UNKNOWN";

export type NotificationRequirement =
  | "REQUIRED"
  | "NOT_REQUIRED"
  | "UNKNOWN";

export interface PayerRequirementEvidence {
  sourceType: RequirementSourceType;
  source: string;
  sourceUrl: string;
  sourceDate?: string;
  verificationDate: string;
  evidence: string;
  effectiveDate?: string;
  version: string;
}

export interface PayerRequirementRecord {
  id: string;
  payer: string;
  planProduct?: string;
  state?: string;
  providerFacility?: string;
  network?: string;
  encounterType?: string;
  admissionType?: string;
  serviceType?: string;
  effectiveDate: string;
  expirationDate?: string | null;
  requirementType:
    | "ADMISSION_NOTIFICATION"
    | "AUTHORIZATION"
    | "SUBMISSION_CHANNEL"
    | "REQUIRED_INFORMATION"
    | "ACKNOWLEDGEMENT";
  requirementValue: string | Record<string, unknown>;
  notificationRequirement?: NotificationRequirement;
  authorizationRequirement?: AuthorizationRequirement;
  notificationWindow?: NotificationWindow | "UNKNOWN";
  status: RequirementStatus;
  evidence: PayerRequirementEvidence;
}

export type ContractProfileSourceType =
  | "PUBLISHED_PAYER_REQUIREMENT_PROFILE"
  | "PROVIDER_PAYER_CONTRACT"
  | "GENERIC_PAYER_TYPE";

export type TransformKind =
  | "PRODUCTION_SPEC"
  | "SYNTHETIC_DEMO_TRANSFORM"
  | "DEMO_TRANSFORM";
