import type { TransformationDefinition } from "@/src/domain/transformations/transformation";

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
];

const PEGA_MAPPINGS: TransformationDefinition["mappings"] = [
  { sourcePath: "notificationType", targetPath: "notificationType", required: true },
  {
    sourcePath: "admission.admissionDateTime",
    targetPath: "AdmissionDateTime",
    required: true,
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
];

/** Full mapping definitions for Step 7. */
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
  ];
}
