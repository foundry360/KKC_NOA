# NOA Admission Field Mappings

Maps the curated **Notification-of-Admission alert** field inventory (Da Vinci CRD encounter-start spreadsheet) onto this platform’s **NOA Accelerator** path.

**Integration model (this POC):** FHIR R4 `Bundle` (`type: message`, A01) → validate → `AdmissionEvent` → rules → contract → transform → deliver → ack  

**Not in this POC:** CDS Hooks `encounter-start` envelope, CRD `coverage-information` cards (`covered`, `pa-needed`, `doc-needed`, DTR/PAS).

---

## In scope (NOA notification payload)

| Domain | FHIR (source) | AdmissionEvent | Mock transform | Salesforce transform | Pega transform |
| ------ | ------------- | -------------- | -------------- | -------------------- | -------------- |
| Member id | `Patient.identifier` type=MB | `patient.memberId` | `patient.memberId` | `MemberId__c` | `MemberID` |
| MRN | `Patient.identifier` (MRN system) | `patient.mrn` | `patient.mrn` | `MRN__c` | `MRN` |
| Name | `Patient.name` | `patient.name.*` | `patient.lastName` / `firstName` | `PatientLastName` / `PatientFirstName` | `MemberLastName` / `MemberFirstName` |
| DOB | `Patient.birthDate` | `patient.birthDate` | `patient.birthDate` | `DateOfBirth__c` | `DateOfBirth` |
| Gender | `Patient.gender` | `patient.gender` | `patient.gender` | `Gender__c` | `Gender` |
| Phone | `Patient.telecom` | `patient.phone` | `patient.phone` | `Phone__c` | `PhoneNumber` |
| Address | `Patient.address` | `patient.address.*` | `patient.address.*` | `AddressLine1__c` / City / State / Postal | `AddressLine1` / City / State / PostalCode |
| Visit id | `Encounter.identifier` type=VN | `encounter.visitId` | `encounter.visitId` | `VisitId__c` | `VisitID` |
| Encounter status | `Encounter.status` | `encounter.status` | `encounter.status` | `EncounterStatus__c` | `EncounterStatus` |
| Encounter class | `Encounter.class` | `encounter.class` | `encounterClass` | `EncounterClass__c` | `EncounterClass` |
| Check-in / admit time | `Encounter.period.start` | `admission.admissionDateTime` | `admissionDateTime` | `admissionDateTime` | `AdmissionDateTime` / `CheckInDateTime` |
| Location | `Encounter.location.display` | `encounter.locationDisplay` | `encounter.locationDisplay` | `LocationName__c` | `EncounterLocationName` |
| Facility | `Organization` (prov) | `facility.*` | `facilityName` / `facilityNpi` | `FacilityName__c` / `FacilityNPI__c` | `FacilityName` / `FacilityNPI` |
| Payer | `Coverage.payor` → Organization | `payer.*` | `payerType` / `payerName` | `PayerType__c` / `PayerName__c` | `PayerType` / `PayerName` |
| Coverage | `Coverage.*` | `coverage.*` | `coverage.*` | `SubscriberId__c` / `Plan__c` | `SubscriberID` / `Plan` / `CoverageStatus` |
| Provider NPI | `Practitioner.identifier` NPI | `providers.0.npi` | `attendingProviderNpi` | `ProviderNPI__c` | `ProviderNPI` |
| Provider name | `Practitioner.name` | `providers.0.name` | `attendingProviderName` | `ProviderName__c` | `ProviderLastName` / `ProviderFirstName` |
| Correlation | (platform) | `correlationId` | `correlationId` | `correlationId` | `correlationId` |
| Notification type | (decision) | — | `notificationType` | `notificationType` | `notificationType` |

Principal diagnosis (`Condition`) remains in the Bundle / canonical model for NOA clinical context (spreadsheet often excludes reason from CRD alert; we keep it for NOA).

---

## Deferred (beyond NOA POC)

| Item | Reason |
| ---- | ------ |
| CDS Hooks `hook` / `hookInstance` / `context` / `prefetch` | Different edge protocol than message Bundle |
| `fhirServer` / `fhirAuthorization` | Optional CRD callback path |
| CRD card `coverage-information` (`covered`, `pa-needed`, `doc-needed`, `info-needed`) | Coverage determination / prior-auth signaling, not delivery ack |
| `coverage-assertion-id`, DTR questionnaire, PAS | Downstream of CRD, not NOA ack |
| SSN, race/ethnicity extensions | Explicitly excluded in spreadsheet; not needed for NOA |
| PractitionerRole as separate resource | Optional; attending captured via Encounter.participant |
| Full Location resource | Location display on Encounter is sufficient for POC |
| Patient.communication (language) | Low priority for NOA notify |

---

## How to extend for another payer system

1. Keep FHIR Bundle + `AdmissionEvent` (shared).  
2. Add/adjust a **transformation** mapping to that system’s field names.  
3. Point a **contract** at the destination + transform.  

No change to Meridian or core pipeline required for each new payer vocabulary.
