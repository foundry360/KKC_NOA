import type { CorrelationId, ISODateTime, UUID } from "../types";

export interface CanonicalHumanName {
  family?: string;
  given?: string[];
  text?: string;
}

export interface CanonicalPatient {
  id?: string;
  mrn?: string;
  name: CanonicalHumanName;
  birthDate?: string;
  gender?: string;
  identifiers?: Array<{ system?: string; value: string }>;
}

export interface CanonicalEncounter {
  id?: string;
  status?: string;
  /** Normalized class, e.g. INPATIENT | OUTPATIENT */
  class: string;
  period?: {
    start?: ISODateTime;
    end?: ISODateTime;
  };
  type?: string;
}

export interface CanonicalAdmission {
  admissionDateTime?: ISODateTime;
  admissionType?: string;
  pointOfOrigin?: string;
  admitSource?: string;
}

export interface CanonicalFacility {
  id?: string;
  npi?: string;
  name?: string;
  address?: {
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
  };
  type?: string;
}

export interface CanonicalPayer {
  id?: string;
  name?: string;
  /** e.g. MEDICARE | MEDICAID | COMMERCIAL */
  payerType?: string;
  identifiers?: Array<{ system?: string; value: string }>;
}

export interface CanonicalCoverage {
  id?: string;
  subscriberId?: string;
  status?: string;
  payorRef?: string;
  plan?: string;
  period?: {
    start?: string;
    end?: string;
  };
}

export interface CanonicalDiagnosis {
  code: string;
  system?: string;
  display?: string;
  rank?: number;
  type?: string;
}

export interface CanonicalProvider {
  id?: string;
  npi?: string;
  name?: CanonicalHumanName;
  role?: string;
}

/**
 * Canonical admission notification used by rules, routing, and transform.
 * FHIR is an edge format only — see docs/FHIR_MODEL.md.
 */
export interface AdmissionEvent {
  eventId: UUID;
  correlationId: CorrelationId;
  sourceSystem: string;
  eventType: "ADMISSION";
  eventTimestamp: ISODateTime;
  patient: CanonicalPatient;
  encounter: CanonicalEncounter;
  admission: CanonicalAdmission;
  facility: CanonicalFacility;
  payer: CanonicalPayer;
  coverage: CanonicalCoverage;
  diagnoses: CanonicalDiagnosis[];
  providers: CanonicalProvider[];
  sourceMetadata: Record<string, unknown>;
}
