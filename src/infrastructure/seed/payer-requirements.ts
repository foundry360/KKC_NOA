import type { PayerRequirementRecord } from "@/src/domain/payer-requirements/types";

const VERIFIED = "2026-09-10";

/**
 * Authoritative published-payer requirements used to drive configurable rules
 * and contract profiles. Values marked UNKNOWN were not verified in primary sources.
 */
export const PAYER_REQUIREMENTS_LIBRARY: PayerRequirementRecord[] = [
  {
    id: "AETNA-COMM-INPATIENT-NOTIFICATION-001",
    payer: "Aetna",
    planProduct: "Commercial",
    encounterType: "INPATIENT",
    admissionType: "EMERGENCY",
    effectiveDate: "2026-08-01",
    requirementType: "ADMISSION_NOTIFICATION",
    requirementValue:
      "Emergency visit resulting in an inpatient hospital admission requires reporting within two business days of the admission.",
    notificationRequirement: "REQUIRED",
    authorizationRequirement: "NOT_REQUIRED_FOR_EMERGENCY_SERVICES",
    notificationWindow: {
      value: 2,
      unit: "BUSINESS_DAYS",
      startEvent: "EMERGENCY_ADMISSION_TIME",
    },
    status: "ACTIVE",
    evidence: {
      sourceType: "PUBLISHED_PAYER_REQUIREMENT",
      source: "Aetna Participating Provider Precertification List (updated Aug 1, 2026)",
      sourceUrl:
        "https://www.aetna.com/content/dam/aetna/pdfs/aetnacom/healthcare-professionals/2026_Precert_List.pdf",
      sourceDate: "2026-08-01",
      verificationDate: VERIFIED,
      evidence:
        "Emergency services section: emergency visit resulting in inpatient hospital admission requires reporting within two business days.",
      effectiveDate: "2026-08-01",
      version: "1.0",
    },
  },
  {
    id: "AETNA-COMM-INPATIENT-PRECERT-001",
    payer: "Aetna",
    planProduct: "Commercial",
    encounterType: "INPATIENT",
    effectiveDate: "2026-08-01",
    requirementType: "AUTHORIZATION",
    requirementValue:
      "Inpatient confinements (including hospital at home, except hospice) appear on the participating provider precertification list. Notification is distinct from coverage determination.",
    notificationRequirement: "UNKNOWN",
    authorizationRequirement: "REQUIRED",
    notificationWindow: "UNKNOWN",
    status: "ACTIVE",
    evidence: {
      sourceType: "PUBLISHED_PAYER_REQUIREMENT",
      source: "Aetna Participating Provider Precertification List + Precertification overview",
      sourceUrl: "https://www.aetna.com/health-care-professionals/precertification.html",
      sourceDate: "2026-08-01",
      verificationDate: VERIFIED,
      evidence:
        "Inpatient confinements listed for precertification; Aetna defines notification as data-entry vs coverage determination as clinical/plan review.",
      version: "1.0",
    },
  },
  {
    id: "AETNA-COMM-ADMISSION-NOTIFY-GENERAL-001",
    payer: "Aetna",
    planProduct: "Commercial",
    encounterType: "INPATIENT",
    effectiveDate: "2020-01-01",
    requirementType: "ADMISSION_NOTIFICATION",
    requirementValue:
      "Provider office manual describes notifying Aetna of hospital admissions within one business day (general admissions protocol).",
    notificationRequirement: "REQUIRED",
    authorizationRequirement: "UNKNOWN",
    notificationWindow: {
      value: 1,
      unit: "BUSINESS_DAYS",
      startEvent: "ADMISSION_TIME",
    },
    status: "ACTIVE",
    evidence: {
      sourceType: "PUBLISHED_PAYER_REQUIREMENT",
      source: "Aetna Office Manual for Health Care Professionals (admissions protocol)",
      sourceUrl:
        "https://www.aetna.com/content/dam/aetna/pdfs/aetnacom/health-care-professionals/office_manual_hcp.pdf",
      verificationDate: VERIFIED,
      evidence:
        "Admissions protocol: notify of hospital admissions within one business day. State/contract variations may apply.",
      version: "1.0",
    },
  },
  {
    id: "AETNA-COMM-REQUIRED-INFO-001",
    payer: "Aetna",
    planProduct: "Commercial",
    effectiveDate: "2020-01-01",
    requirementType: "REQUIRED_INFORMATION",
    requirementValue: {
      documentedFields: [
        "requestingAndServicingProviderNpi",
        "contactNameAndPhone",
        "memberId",
        "dateOfBirth",
        "diagnosisCode",
        "placeOfService",
        "admitOrServiceDate",
        "procedureCodesForNonAdmissions",
      ],
      outboundPayloadSpec: "UNKNOWN",
    },
    status: "ACTIVE",
    evidence: {
      sourceType: "PUBLISHED_PAYER_REQUIREMENT",
      source: "Aetna Precertification and Referral Guide",
      sourceUrl:
        "https://www.aetna.com/document-library/healthcare-professionals/assets/documents/aetna-precertification-and-referral-guide.pdf",
      verificationDate: VERIFIED,
      evidence:
        "Having this information ready lists member ID, DOB, diagnosis, place of service, admit/service date, provider NPIs. Exact production EDI/API payload schema: UNKNOWN.",
      version: "1.0",
    },
  },
  {
    id: "CIGNA-COMM-EMERGENCY-IP-REPORT-001",
    payer: "Cigna",
    planProduct: "Commercial",
    encounterType: "INPATIENT",
    admissionType: "EMERGENCY",
    effectiveDate: "2020-01-01",
    requirementType: "ADMISSION_NOTIFICATION",
    requirementValue:
      "Precertification is not required for emergency services. Emergency services that result in an inpatient hospital admission must be reported within one business day of the admission unless dictated otherwise by state mandate.",
    notificationRequirement: "REQUIRED",
    authorizationRequirement: "NOT_REQUIRED_FOR_EMERGENCY_SERVICES",
    notificationWindow: {
      value: 1,
      unit: "BUSINESS_DAYS",
      startEvent: "EMERGENCY_ADMISSION_TIME",
    },
    status: "ACTIVE",
    evidence: {
      sourceType: "PUBLISHED_PAYER_REQUIREMENT",
      source: "Cigna Healthcare Precertifications and Prior Authorizations (provider site)",
      sourceUrl:
        "https://www.cigna.com/health-care-providers/coverage-and-claims/precertification",
      verificationDate: VERIFIED,
      evidence:
        "Emergency services → inpatient hospital admission must be reported within one business day unless state mandate differs.",
      version: "1.0",
    },
  },
  {
    id: "CIGNA-COMM-INPATIENT-NOTIFICATION-CHANNEL-001",
    payer: "Cigna",
    planProduct: "Commercial",
    encounterType: "INPATIENT",
    effectiveDate: "2025-01-01",
    requirementType: "SUBMISSION_CHANNEL",
    requirementValue: {
      inpatientNotificationViaOnlinePrecertTool: false,
      documentedChannel:
        "Contact Provider Services at 800.882.4462 for inpatient, discharge, and transfer notification requests.",
      acknowledgementBehavior: "UNKNOWN",
      ediPayloadSpec: "UNKNOWN",
    },
    notificationRequirement: "REQUIRED",
    authorizationRequirement: "UNKNOWN",
    notificationWindow: "UNKNOWN",
    status: "ACTIVE",
    evidence: {
      sourceType: "PUBLISHED_PAYER_REQUIREMENT",
      source: "Cigna Online Precertification Guide 2025 (CignaforHCP)",
      sourceUrl:
        "https://campaigns.cigna.com/static/campaigns-cigna-com/docs/pcomm/chc-online-precert-guide-2025.pdf",
      sourceDate: "2025-01-01",
      verificationDate: VERIFIED,
      evidence:
        "Q20: inpatient notifications cannot be submitted through the online precertification request tool; contact Provider Services.",
      version: "1.0",
    },
  },
  {
    id: "CIGNA-COMM-ELECTIVE-PRECERT-001",
    payer: "Cigna",
    planProduct: "Commercial",
    encounterType: "INPATIENT",
    admissionType: "ELECTIVE",
    effectiveDate: "2020-01-01",
    requirementType: "AUTHORIZATION",
    requirementValue:
      "Rendering providers/facilities must confirm precertification has been approved before performing elective (non-emergency) services when the patient's plan requires precertification.",
    notificationRequirement: "UNKNOWN",
    authorizationRequirement: "REQUIRED",
    notificationWindow: "UNKNOWN",
    status: "ACTIVE",
    evidence: {
      sourceType: "PUBLISHED_PAYER_REQUIREMENT",
      source: "Cigna Healthcare Precertifications and Prior Authorizations",
      sourceUrl:
        "https://www.cigna.com/health-care-providers/coverage-and-claims/precertification",
      verificationDate: VERIFIED,
      evidence:
        "Elective/non-emergency services: confirm precertification approved before performing service when plan requires it.",
      version: "1.0",
    },
  },
  {
    id: "BCBSAZ-COMM-POST-ADMISSION-NOTIFICATION-001",
    payer: "Blue Cross Blue Shield of Arizona",
    planProduct: "Commercial Group and Individual/Family",
    state: "AZ",
    encounterType: "INPATIENT",
    effectiveDate: "2026-01-01",
    requirementType: "ADMISSION_NOTIFICATION",
    requirementValue:
      "For AZ Blue Commercial Group and Individual/Family plans, post-admission notification is always required within 48 hours. When prior authorization is not required, pre-admission notification is required.",
    notificationRequirement: "REQUIRED",
    authorizationRequirement: "CODE_DEPENDENT",
    notificationWindow: {
      value: 48,
      unit: "HOURS",
      startEvent: "ADMISSION_TIME",
    },
    status: "ACTIVE",
    evidence: {
      sourceType: "PUBLISHED_PAYER_REQUIREMENT",
      source:
        "AZ Blue Provider Operating Guide — Inpatient Notification and Prior Authorization Requirements Quick Guide",
      sourceUrl:
        "https://edge.sitecorecloud.io/bluecross-6f8ea2ea/media/project/bcbs-az/azblue/data/media/files/providers/resources/prior-auth-and-med-policies/inpatient-admissions-quick-guide.pdf",
      sourceDate: "2026-01-01",
      verificationDate: VERIFIED,
      evidence:
        "AZ Blue Commercial Group and Individual/Family Plans: post-admission notification always required within 48 hours; channels include Availity, fax face sheet 844-263-2272, phone.",
      version: "1.0",
    },
  },
  {
    id: "BCBSAZ-COMM-REQUIRED-INFO-001",
    payer: "Blue Cross Blue Shield of Arizona",
    planProduct: "Commercial",
    state: "AZ",
    effectiveDate: "2026-01-01",
    requirementType: "REQUIRED_INFORMATION",
    requirementValue: {
      documentedFields: [
        "memberSubscriberName",
        "dateOfBirth",
        "memberId",
        "providerNameNpiTaxIdSpecialtyContact",
        "dateTypePlaceOfService",
        "procedureCodes",
        "diagnosisCodes",
      ],
      outboundPayloadSpec: "UNKNOWN",
    },
    status: "ACTIVE",
    evidence: {
      sourceType: "PUBLISHED_PAYER_REQUIREMENT",
      source: "AZ Blue Provider Operating Guide Section 11 (Medical Policies and Prior Authorization)",
      sourceUrl:
        "https://edge.sitecorecloud.io/bluecross-6f8ea2ea/media/project/bcbs-az/azblue/data/media/files/providers/e-learning/11-medical-policies-and-prior-authorization-provider-operating-guide.pdf",
      verificationDate: VERIFIED,
      evidence:
        "Required information to process a notification or prior authorization request includes member identifiers, provider identifiers, date/type/place of service, procedures, diagnoses.",
      version: "1.0",
    },
  },
  {
    id: "BCBSAZ-COMM-ALL-ADMISSIONS-NOTICE-001",
    payer: "Blue Cross Blue Shield of Arizona",
    planProduct: "Commercial",
    state: "AZ",
    encounterType: "INPATIENT",
    effectiveDate: "2026-01-01",
    requirementType: "ADMISSION_NOTIFICATION",
    requirementValue:
      "All AZ Blue benefit plans require notice of inpatient admissions. Most plans require prior authorization only for codes on the prior authorization list; some plans require PA for all scheduled inpatient admissions.",
    notificationRequirement: "REQUIRED",
    authorizationRequirement: "CODE_DEPENDENT",
    notificationWindow: "UNKNOWN",
    status: "ACTIVE",
    evidence: {
      sourceType: "PUBLISHED_PAYER_REQUIREMENT",
      source: "AZ Blue Provider Operating Guide Section 11",
      sourceUrl:
        "https://edge.sitecorecloud.io/bluecross-6f8ea2ea/media/project/bcbs-az/azblue/data/media/files/providers/e-learning/11-medical-policies-and-prior-authorization-provider-operating-guide.pdf",
      verificationDate: VERIFIED,
      evidence:
        "All benefit plans require notice of inpatient admissions; PA requirements vary by plan/code list.",
      version: "1.0",
    },
  },
];

export function findRequirements(filter: {
  payer?: string;
  requirementType?: PayerRequirementRecord["requirementType"];
}): PayerRequirementRecord[] {
  return PAYER_REQUIREMENTS_LIBRARY.filter((r) => {
    if (filter.payer && r.payer !== filter.payer) return false;
    if (filter.requirementType && r.requirementType !== filter.requirementType) {
      return false;
    }
    return true;
  });
}
