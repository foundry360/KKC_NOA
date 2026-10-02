import type { TransformationDefinition } from "@/src/domain/transformations/transformation";

/** Shared optional NOA admission-alert fields (spreadsheet “pass in alert” subset). */
const SHARED_OPTIONAL_IDENTITY: TransformationDefinition["mappings"] = [
  { sourcePath: "patient.memberId", targetPath: "patient.memberId", required: false },
  { sourcePath: "patient.mrn", targetPath: "patient.mrn", required: false },
  { sourcePath: "patient.birthDate", targetPath: "patient.birthDate", required: false },
  { sourcePath: "patient.gender", targetPath: "patient.gender", required: false },
  { sourcePath: "patient.phone", targetPath: "patient.phone", required: false },
  {
    sourcePath: "patient.address.line",
    targetPath: "patient.address.line1",
    required: false,
    transform: "first",
  },
  { sourcePath: "patient.address.city", targetPath: "patient.address.city", required: false },
  { sourcePath: "patient.address.state", targetPath: "patient.address.state", required: false },
  {
    sourcePath: "patient.address.postalCode",
    targetPath: "patient.address.postalCode",
    required: false,
  },
  { sourcePath: "encounter.visitId", targetPath: "encounter.visitId", required: false },
  { sourcePath: "encounter.status", targetPath: "encounter.status", required: false },
  {
    sourcePath: "encounter.locationDisplay",
    targetPath: "encounter.locationDisplay",
    required: false,
  },
  { sourcePath: "facility.npi", targetPath: "facilityNpi", required: false },
  { sourcePath: "payer.name", targetPath: "payerName", required: false },
  { sourcePath: "coverage.subscriberId", targetPath: "coverage.subscriberId", required: false },
  { sourcePath: "coverage.status", targetPath: "coverage.status", required: false },
  { sourcePath: "coverage.plan", targetPath: "coverage.plan", required: false },
  { sourcePath: "coverage.groupNumber", targetPath: "coverage.groupNumber", required: false },
  { sourcePath: "providers.0.npi", targetPath: "attendingProviderNpi", required: false },
  {
    sourcePath: "providers.0.name.family",
    targetPath: "attendingProviderLastName",
    required: false,
  },
  {
    sourcePath: "providers.0.name.given",
    targetPath: "attendingProviderFirstName",
    required: false,
    transform: "first",
  },
];

const MOCK_MAPPINGS: TransformationDefinition["mappings"] = [
  { sourcePath: "notificationType", targetPath: "notificationType", required: true },
  {
    sourcePath: "admission.admissionDateTime",
    targetPath: "admissionDateTime",
    required: true,
    transform: "dateIso",
  },
  {
    sourcePath: "patient.name.family",
    targetPath: "patient.lastName",
    required: true,
  },
  {
    sourcePath: "patient.name.given",
    targetPath: "patient.firstName",
    required: false,
    transform: "first",
  },
  { sourcePath: "encounter.class", targetPath: "encounterClass", required: true },
  { sourcePath: "payer.payerType", targetPath: "payerType", required: true },
  { sourcePath: "facility.name", targetPath: "facilityName", required: false },
  { sourcePath: "correlationId", targetPath: "correlationId", required: true },
  ...SHARED_OPTIONAL_IDENTITY,
];

const SF_MAPPINGS: TransformationDefinition["mappings"] = [
  { sourcePath: "notificationType", targetPath: "notificationType", required: true },
  {
    sourcePath: "admission.admissionDateTime",
    targetPath: "admissionDateTime",
    required: true,
  },
  {
    sourcePath: "patient.name.family",
    targetPath: "PatientLastName",
    required: true,
  },
  {
    sourcePath: "patient.name.given",
    targetPath: "PatientFirstName",
    required: false,
    transform: "first",
  },
  { sourcePath: "encounter.class", targetPath: "EncounterClass__c", required: true },
  { sourcePath: "payer.payerType", targetPath: "PayerType__c", required: true },
  { sourcePath: "correlationId", targetPath: "correlationId", required: true },
  { sourcePath: "patient.memberId", targetPath: "MemberId__c", required: false },
  { sourcePath: "patient.mrn", targetPath: "MRN__c", required: false },
  { sourcePath: "patient.birthDate", targetPath: "DateOfBirth__c", required: false },
  { sourcePath: "patient.gender", targetPath: "Gender__c", required: false },
  { sourcePath: "patient.phone", targetPath: "Phone__c", required: false },
  {
    sourcePath: "patient.address.line",
    targetPath: "AddressLine1__c",
    required: false,
    transform: "first",
  },
  { sourcePath: "patient.address.city", targetPath: "City__c", required: false },
  { sourcePath: "patient.address.state", targetPath: "State__c", required: false },
  { sourcePath: "patient.address.postalCode", targetPath: "PostalCode__c", required: false },
  { sourcePath: "encounter.visitId", targetPath: "VisitId__c", required: false },
  { sourcePath: "encounter.status", targetPath: "EncounterStatus__c", required: false },
  {
    sourcePath: "encounter.locationDisplay",
    targetPath: "LocationName__c",
    required: false,
  },
  { sourcePath: "facility.name", targetPath: "FacilityName__c", required: false },
  { sourcePath: "facility.npi", targetPath: "FacilityNPI__c", required: false },
  { sourcePath: "payer.name", targetPath: "PayerName__c", required: false },
  { sourcePath: "coverage.subscriberId", targetPath: "SubscriberId__c", required: false },
  { sourcePath: "coverage.plan", targetPath: "Plan__c", required: false },
  { sourcePath: "providers.0.npi", targetPath: "ProviderNPI__c", required: false },
  {
    sourcePath: "providers.0.name.family",
    targetPath: "ProviderLastName__c",
    required: false,
  },
  {
    sourcePath: "providers.0.name.given",
    targetPath: "ProviderFirstName__c",
    required: false,
    transform: "first",
  },
];

/** Pega property names aligned to the NOA alert spreadsheet (illustrative). */
const PEGA_MAPPINGS: TransformationDefinition["mappings"] = [
  { sourcePath: "notificationType", targetPath: "notificationType", required: true },
  {
    sourcePath: "admission.admissionDateTime",
    targetPath: "AdmissionDateTime",
    required: true,
  },
  {
    sourcePath: "admission.admissionDateTime",
    targetPath: "CheckInDateTime",
    required: false,
  },
  {
    sourcePath: "patient.name.family",
    targetPath: "MemberLastName",
    required: true,
  },
  {
    sourcePath: "patient.name.given",
    targetPath: "MemberFirstName",
    required: false,
    transform: "first",
  },
  { sourcePath: "encounter.class", targetPath: "EncounterClass", required: true },
  { sourcePath: "payer.payerType", targetPath: "PayerType", required: true },
  { sourcePath: "correlationId", targetPath: "correlationId", required: true },
  { sourcePath: "patient.memberId", targetPath: "MemberID", required: false },
  { sourcePath: "patient.mrn", targetPath: "MRN", required: false },
  { sourcePath: "patient.birthDate", targetPath: "DateOfBirth", required: false },
  { sourcePath: "patient.gender", targetPath: "Gender", required: false },
  { sourcePath: "patient.phone", targetPath: "PhoneNumber", required: false },
  {
    sourcePath: "patient.address.line",
    targetPath: "AddressLine1",
    required: false,
    transform: "first",
  },
  { sourcePath: "patient.address.city", targetPath: "City", required: false },
  { sourcePath: "patient.address.state", targetPath: "State", required: false },
  { sourcePath: "patient.address.postalCode", targetPath: "PostalCode", required: false },
  { sourcePath: "encounter.visitId", targetPath: "VisitID", required: false },
  { sourcePath: "encounter.status", targetPath: "EncounterStatus", required: false },
  {
    sourcePath: "encounter.locationDisplay",
    targetPath: "EncounterLocationName",
    required: false,
  },
  { sourcePath: "facility.name", targetPath: "FacilityName", required: false },
  { sourcePath: "facility.npi", targetPath: "FacilityNPI", required: false },
  { sourcePath: "payer.name", targetPath: "PayerName", required: false },
  { sourcePath: "coverage.subscriberId", targetPath: "SubscriberID", required: false },
  { sourcePath: "coverage.status", targetPath: "CoverageStatus", required: false },
  { sourcePath: "coverage.plan", targetPath: "Plan", required: false },
  { sourcePath: "coverage.groupNumber", targetPath: "GroupNumber", required: false },
  { sourcePath: "providers.0.npi", targetPath: "ProviderNPI", required: false },
  {
    sourcePath: "providers.0.name.family",
    targetPath: "ProviderLastName",
    required: false,
  },
  {
    sourcePath: "providers.0.name.given",
    targetPath: "ProviderFirstName",
    required: false,
    transform: "first",
  },
];

/**
 * SYNTHETIC_DEMO_TRANSFORM — fields limited to those documented in public Aetna
 * precert/referral materials. Not a production Aetna EDI/API payload.
 */
const AETNA_DEMO_MAPPINGS: TransformationDefinition["mappings"] = [
  {
    sourcePath: "_meta.transactionKind",
    targetPath: "transactionKind",
    required: false,
    defaultValue: "ADMISSION_NOTIFICATION",
  },
  {
    sourcePath: "_meta.transformKind",
    targetPath: "transformKind",
    required: false,
    defaultValue: "SYNTHETIC_DEMO_TRANSFORM",
  },
  {
    sourcePath: "_meta.payerProfile",
    targetPath: "payerProfile",
    required: false,
    defaultValue: "AETNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1",
  },
  {
    sourcePath: "_meta.notificationWindow",
    targetPath: "notificationWindow",
    required: false,
    defaultValue: {
      value: 2,
      unit: "BUSINESS_DAYS",
      startEvent: "EMERGENCY_ADMISSION_TIME",
    },
  },
  { sourcePath: "patient.memberId", targetPath: "memberId", required: false },
  { sourcePath: "coverage.subscriberId", targetPath: "memberId", required: false },
  { sourcePath: "patient.birthDate", targetPath: "dateOfBirth", required: false },
  {
    sourcePath: "admission.admissionDateTime",
    targetPath: "admissionDateTime",
    required: true,
    transform: "dateIso",
  },
  {
    sourcePath: "diagnoses.0.code",
    targetPath: "diagnosisCode",
    required: false,
  },
  { sourcePath: "encounter.class", targetPath: "placeOfServiceClass", required: true },
  { sourcePath: "facility.npi", targetPath: "facilityNpi", required: false },
  { sourcePath: "facility.name", targetPath: "facilityName", required: false },
  { sourcePath: "providers.0.npi", targetPath: "servicingProviderNpi", required: false },
  { sourcePath: "payer.name", targetPath: "payerName", required: true },
  { sourcePath: "correlationId", targetPath: "correlationId", required: true },
  {
    sourcePath: "_meta.authorizationNote",
    targetPath: "authorizationNote",
    required: false,
    defaultValue:
      "Notification is distinct from coverage determination / precertification.",
  },
];

/**
 * SYNTHETIC_DEMO_TRANSFORM — Cigna inpatient notification channel + report window
 * from public docs. Not a production Cigna payload.
 */
const CIGNA_DEMO_MAPPINGS: TransformationDefinition["mappings"] = [
  {
    sourcePath: "_meta.transactionKind",
    targetPath: "transactionKind",
    required: false,
    defaultValue: "ADMISSION_NOTIFICATION",
  },
  {
    sourcePath: "_meta.transformKind",
    targetPath: "transformKind",
    required: false,
    defaultValue: "SYNTHETIC_DEMO_TRANSFORM",
  },
  {
    sourcePath: "_meta.payerProfile",
    targetPath: "payerProfile",
    required: false,
    defaultValue: "CIGNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1",
  },
  {
    sourcePath: "_meta.submissionChannel",
    targetPath: "submissionChannel",
    required: false,
    defaultValue: "PROVIDER_SERVICES_PHONE",
  },
  {
    sourcePath: "_meta.onlinePrecertToolAllowed",
    targetPath: "onlinePrecertToolAllowedForInpatientNotification",
    required: false,
    defaultValue: false,
  },
  {
    sourcePath: "_meta.notificationWindow",
    targetPath: "notificationWindow",
    required: false,
    defaultValue: {
      value: 1,
      unit: "BUSINESS_DAYS",
      startEvent: "EMERGENCY_ADMISSION_TIME",
    },
  },
  { sourcePath: "patient.memberId", targetPath: "memberId", required: false },
  { sourcePath: "coverage.subscriberId", targetPath: "memberId", required: false },
  {
    sourcePath: "admission.admissionDateTime",
    targetPath: "admissionDateTime",
    required: true,
    transform: "dateIso",
  },
  {
    sourcePath: "diagnoses.0.code",
    targetPath: "primaryDiagnosisCode",
    required: false,
  },
  { sourcePath: "facility.name", targetPath: "servicingFacilityName", required: false },
  { sourcePath: "facility.npi", targetPath: "servicingFacilityNpi", required: false },
  { sourcePath: "payer.name", targetPath: "payerName", required: true },
  { sourcePath: "correlationId", targetPath: "correlationId", required: true },
  {
    sourcePath: "_meta.authorizationNote",
    targetPath: "authorizationNote",
    required: false,
    defaultValue:
      "Emergency services do not require precertification; reporting inpatient admission is a notification, not an authorization approval.",
  },
];

/**
 * SYNTHETIC_DEMO_TRANSFORM — AZ Blue commercial required notification fields /
 * channels from public quick guide. Not a production AZ Blue payload.
 */
const BCBSAZ_DEMO_MAPPINGS: TransformationDefinition["mappings"] = [
  {
    sourcePath: "_meta.transactionKind",
    targetPath: "transactionKind",
    required: false,
    defaultValue: "ADMISSION_NOTIFICATION",
  },
  {
    sourcePath: "_meta.transformKind",
    targetPath: "transformKind",
    required: false,
    defaultValue: "SYNTHETIC_DEMO_TRANSFORM",
  },
  {
    sourcePath: "_meta.payerProfile",
    targetPath: "payerProfile",
    required: false,
    defaultValue: "BCBSAZ_COMMERCIAL_INPATIENT_NOTIFICATION_V1",
  },
  {
    sourcePath: "_meta.submissionChannels",
    targetPath: "submissionChannels",
    required: false,
    defaultValue: ["AVAILITY", "FAX", "PHONE"],
  },
  {
    sourcePath: "_meta.notificationWindow",
    targetPath: "notificationWindow",
    required: false,
    defaultValue: {
      value: 48,
      unit: "HOURS",
      startEvent: "ADMISSION_TIME",
    },
  },
  {
    sourcePath: "patient.name.family",
    targetPath: "memberName.family",
    required: false,
  },
  {
    sourcePath: "patient.name.given",
    targetPath: "memberName.given",
    required: false,
    transform: "first",
  },
  { sourcePath: "patient.birthDate", targetPath: "dateOfBirth", required: false },
  { sourcePath: "patient.memberId", targetPath: "memberId", required: false },
  { sourcePath: "coverage.subscriberId", targetPath: "memberId", required: false },
  {
    sourcePath: "admission.admissionDateTime",
    targetPath: "admissionDateTime",
    required: true,
    transform: "dateIso",
  },
  {
    sourcePath: "diagnoses.0.code",
    targetPath: "diagnosisCodes.0",
    required: false,
  },
  { sourcePath: "encounter.class", targetPath: "placeOfService", required: true },
  { sourcePath: "facility.npi", targetPath: "facilityNpi", required: false },
  { sourcePath: "facility.name", targetPath: "facilityName", required: false },
  { sourcePath: "providers.0.npi", targetPath: "providerNpi", required: false },
  { sourcePath: "payer.name", targetPath: "payerName", required: true },
  { sourcePath: "correlationId", targetPath: "correlationId", required: true },
  {
    sourcePath: "_meta.authorizationNote",
    targetPath: "authorizationNote",
    required: false,
    defaultValue:
      "Prior authorization is code/plan dependent and separate from post-admission notification.",
  },
];

/** Full mapping definitions for Step 7 + NOA admission-alert field expansion. */
export function createSeedTransformations(): TransformationDefinition[] {
  return [
    {
      id: "33333333-3333-4333-8333-333333333001",
      code: "MEDICARE_NOA_MOCK_TRANSFORM",
      version: 1,
      sourceModel: "AdmissionEvent",
      targetFormat: "JSON",
      mappings: MOCK_MAPPINGS,
    },
    {
      id: "33333333-3333-4333-8333-333333333002",
      code: "MEDICARE_NOA_SF_TRANSFORM",
      version: 1,
      sourceModel: "AdmissionEvent",
      targetFormat: "JSON",
      mappings: SF_MAPPINGS,
    },
    {
      id: "33333333-3333-4333-8333-333333333003",
      code: "MEDICARE_NOA_PEGA_TRANSFORM",
      version: 1,
      sourceModel: "AdmissionEvent",
      targetFormat: "JSON",
      mappings: PEGA_MAPPINGS,
    },
    {
      id: "33333333-3333-4333-8333-333333333004",
      code: "AETNA_ADMISSION_NOTIFICATION_V1",
      version: 1,
      sourceModel: "AdmissionEvent",
      targetFormat: "JSON",
      mappings: AETNA_DEMO_MAPPINGS,
    },
    {
      id: "33333333-3333-4333-8333-333333333005",
      code: "CIGNA_ADMISSION_NOTIFICATION_V1",
      version: 1,
      sourceModel: "AdmissionEvent",
      targetFormat: "JSON",
      mappings: CIGNA_DEMO_MAPPINGS,
    },
    {
      id: "33333333-3333-4333-8333-333333333006",
      code: "BCBSAZ_ADMISSION_NOTIFICATION_V1",
      version: 1,
      sourceModel: "AdmissionEvent",
      targetFormat: "JSON",
      mappings: BCBSAZ_DEMO_MAPPINGS,
    },
  ];
}
