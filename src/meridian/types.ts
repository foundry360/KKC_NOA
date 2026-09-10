export type Sex = "male" | "female" | "other" | "unknown";

export type EncounterClass =
  | "INPATIENT"
  | "OBSERVATION"
  | "EMERGENCY";

export type AdmissionType =
  | "Emergency"
  | "Elective"
  | "Urgent"
  | "Transfer";

export type PatientCensusStatus =
  | "Admitted"
  | "Active"
  | "Pending"
  | "Discharged";

export interface Facility {
  id: string;
  name: string;
  npi?: string;
}

export interface Department {
  id: string;
  facilityId: string;
  name: string;
}

export interface Provider {
  id: string;
  npi?: string;
  name: string;
  credentials: string;
  specialty?: string;
}

export interface PayerDef {
  id: string;
  name: string;
  /** MEDICARE | MEDICAID | COMMERCIAL — used in FHIR payer org identifier */
  payerType: "MEDICARE" | "MEDICAID" | "COMMERCIAL";
}

export interface CoverageInfo {
  payerId: string;
  payerName: string;
  payerType: PayerDef["payerType"];
  plan: string;
  memberId: string;
  groupNumber?: string;
  coverageType: string;
}

export interface Address {
  line: string[];
  city: string;
  state: string;
  postalCode: string;
}

export interface Patient {
  id: string;
  mrn: string;
  family: string;
  given: string[];
  sex: Sex;
  birthDate: string;
  phone?: string;
  address: Address;
  coverage: CoverageInfo;
  diagnoses: string[];
  attendingProviderId?: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  encounterClass: EncounterClass;
  admissionType: AdmissionType;
  status: PatientCensusStatus;
  facilityId: string;
  departmentId: string;
  unit: string;
  room: string;
  bed?: string;
  admittedAt: string;
  attendingProviderId: string;
  principalDiagnosis: string;
  service?: string;
  coverageSnapshot: CoverageInfo;
}

export interface FhirEventRecord {
  id: string;
  patientId: string;
  encounterId: string;
  createdAt: string;
  status: "CREATED" | "SENT" | "FAILED";
  fhirVersion: "R4";
  eventType: "ADMISSION";
  correlationId?: string;
  bundle: Record<string, unknown>;
  sendError?: string;
  demoMode?: boolean;
}

export interface NotificationTrack {
  id: string;
  patientId: string;
  encounterId: string;
  fhirEventId: string;
  correlationId: string;
  createdAt: string;
  noaEventId?: string;
  processingState?: string;
  acknowledgement?: {
    acknowledgedAt?: string;
    ackId?: string;
  };
  adapterKey?: string;
  decision?: string;
  demoMode: boolean;
  timeline: Array<{
    step: string;
    status: "pending" | "done" | "failed";
    at?: string;
  }>;
}

export interface AdmitInput {
  patientId: string;
  encounterClass: EncounterClass;
  admissionType: AdmissionType;
  facilityId: string;
  departmentId: string;
  unit: string;
  room: string;
  bed?: string;
  admittedAt: string;
  attendingProviderId: string;
  principalDiagnosis: string;
  service?: string;
  coverage: CoverageInfo;
  /** Optional demo override forwarded as X-Contract-Id */
  contractBusinessId?: string;
}

export interface CreatePatientInput {
  family: string;
  given: string[];
  sex: Sex;
  birthDate: string;
  phone?: string;
  address: Address;
  coverage: CoverageInfo;
  diagnoses?: string[];
  attendingProviderId?: string;
  /** Optional; auto-assigned if omitted */
  mrn?: string;
}

export type UpdatePatientInput = Partial<
  Omit<Patient, "id" | "mrn"> & { mrn?: string }
> & {
  id: string;
};
