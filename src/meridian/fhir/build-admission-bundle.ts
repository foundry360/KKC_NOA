import type {
  Department,
  Encounter,
  Facility,
  Patient,
  Provider,
} from "@/src/meridian/types";

const CLASS_CODE: Record<Encounter["encounterClass"], string> = {
  INPATIENT: "IMP",
  /** Maps to outpatient-class path in NOA for Scenario B demos */
  OBSERVATION: "AMB",
  EMERGENCY: "EMER",
}

const DIAGNOSIS_CODES: Record<string, { code: string; display: string }> = {
  Pneumonia: { code: "J18.9", display: "Pneumonia, unspecified organism" },
  "Chest pain": { code: "R07.9", display: "Chest pain, unspecified" },
  "CHF exacerbation": {
    code: "I50.9",
    display: "Heart failure, unspecified",
  },
  COPD: { code: "J44.1", display: "COPD with acute exacerbation" },
  Cellulitis: { code: "L03.90", display: "Cellulitis, unspecified" },
  Appendicitis: { code: "K35.80", display: "Unspecified acute appendicitis" },
  default: { code: "R69", display: "Illness, unspecified" },
};

function dx(name: string) {
  return DIAGNOSIS_CODES[name] ?? { code: "R69", display: name };
}

const ATTENDER = [
  {
    coding: [
      {
        system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
        code: "ATND",
        display: "attender",
      },
    ],
  },
];

function practitionerEntry(provider: Provider) {
  return {
    fullUrl: `urn:uuid:${provider.id}`,
    resource: {
      resourceType: "Practitioner",
      id: provider.id,
      identifier: provider.npi
        ? [{ system: "http://hl7.org/fhir/sid/us-npi", value: provider.npi }]
        : undefined,
      name: [
        {
          family: provider.name.split(" ").slice(-1)[0],
          given: provider.name.split(" ").slice(0, -1),
          text: `${provider.name}, ${provider.credentials}`,
        },
      ],
    },
  };
}

/** ED Encounter for ER-to-admit; ends where the admitted encounter begins. */
function edEncounterEntry(args: {
  id: string;
  encounter: Encounter;
  edProvider: Provider;
  patientRef: string;
  facilityRef: string;
}) {
  const { id, encounter, edProvider, patientRef, facilityRef } = args;
  const ed = encounter.edVisit!;
  return {
    fullUrl: `urn:uuid:${id}`,
    resource: {
      resourceType: "Encounter",
      id,
      status: "finished",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "EMER",
        display: "emergency",
      },
      priority: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-ActPriority",
            code: "EM",
            display: "emergency",
          },
        ],
      },
      subject: { reference: patientRef },
      period: { start: ed.arrivedAt, end: encounter.admittedAt },
      serviceProvider: { reference: facilityRef },
      location: [{ location: { display: ed.location } }],
      reasonCode: [{ text: ed.chiefComplaint }],
      participant: [
        { type: ATTENDER, individual: { reference: `Practitioner/${edProvider.id}` } },
      ],
    },
  };
}

export function buildAdmissionBundle(input: {
  patient: Patient;
  encounter: Encounter;
  facility: Facility;
  department: Department;
  provider: Provider;
  /** Required when encounter.edVisit is set. */
  edProvider?: Provider;
}): Record<string, unknown> {
  const { patient, encounter, facility, provider, edProvider } = input;
  const edEncounterId =
    encounter.edVisit && edProvider ? `ed-${encounter.id}` : undefined;
  const edEncounterRef = edEncounterId ? `Encounter/${edEncounterId}` : undefined;
  const patientRef = `Patient/${patient.id}`;
  const encounterRef = `Encounter/${encounter.id}`;
  const facilityRef = `Organization/${facility.id}`;
  const payerOrgId = `payer-${encounter.coverageSnapshot.payerId}`;
  const payerRef = `Organization/${payerOrgId}`;
  const practitionerRef = `Practitioner/${provider.id}`;
  const coverageId = `coverage-${encounter.id}`;
  const conditionId = `condition-${encounter.id}`;
  const messageId = `message-${encounter.id}`;
  const diagnosis = dx(encounter.principalDiagnosis);
  const timestamp = encounter.admittedAt;

  return {
    resourceType: "Bundle",
    id: `meridian-admission-${encounter.id}`,
    type: "message",
    timestamp,
    entry: [
      {
        fullUrl: `urn:uuid:${messageId}`,
        resource: {
          resourceType: "MessageHeader",
          id: messageId,
          eventCoding: {
            system: "http://terminology.hl7.org/CodeSystem/v2-0003",
            code: "A01",
            display: "ADT/ACK - Admit/visit notification",
          },
          source: {
            name: "Meridian Clinical",
            endpoint: "urn:meridian:clinical",
          },
          focus: [{ reference: encounterRef }],
        },
      },
      {
        fullUrl: `urn:uuid:${patient.id}`,
        resource: {
          resourceType: "Patient",
          id: patient.id,
          identifier: [
            {
              system: "http://meridian.health/mrn",
              value: patient.mrn,
            },
            {
              type: {
                coding: [
                  {
                    system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                    code: "MB",
                    display: "Member Number",
                  },
                ],
              },
              system: "http://meridian.health/member-id",
              value: encounter.coverageSnapshot.memberId,
            },
          ],
          name: [
            {
              use: "official",
              family: patient.family,
              given: patient.given,
            },
          ],
          gender: patient.sex,
          birthDate: patient.birthDate,
          telecom: patient.phone
            ? [{ system: "phone", value: patient.phone }]
            : undefined,
          address: [
            {
              line: patient.address.line,
              city: patient.address.city,
              state: patient.address.state,
              postalCode: patient.address.postalCode,
            },
          ],
        },
      },
      ...(edEncounterId && edProvider
        ? [
            edEncounterEntry({
              id: edEncounterId,
              encounter,
              edProvider,
              patientRef,
              facilityRef,
            }),
          ]
        : []),
      {
        fullUrl: `urn:uuid:${encounter.id}`,
        resource: {
          resourceType: "Encounter",
          id: encounter.id,
          identifier: [
            {
              type: {
                coding: [
                  {
                    system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                    code: "VN",
                    display: "Visit number",
                  },
                ],
              },
              system: "http://meridian.health/visit",
              value: encounter.id,
            },
          ],
          status: "in-progress",
          class: {
            system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            code: CLASS_CODE[encounter.encounterClass],
            display: encounter.encounterClass.toLowerCase(),
          },
          subject: { reference: patientRef },
          period: { start: timestamp },
          ...(edEncounterRef
            ? {
                partOf: { reference: edEncounterRef },
                hospitalization: {
                  admitSource: {
                    coding: [
                      {
                        system: "http://terminology.hl7.org/CodeSystem/admit-source",
                        code: "emd",
                        display: "From accident/emergency department",
                      },
                    ],
                  },
                  origin: { reference: edEncounterRef },
                },
              }
            : {}),
          serviceProvider: { reference: facilityRef },
          location: [
            {
              location: {
                display: `${encounter.unit} / Room ${encounter.room}`,
              },
            },
          ],
          participant: [
            { type: ATTENDER, individual: { reference: practitionerRef } },
          ],
          diagnosis: [
            {
              condition: { reference: `Condition/${conditionId}` },
              use: {
                coding: [
                  {
                    system:
                      "http://terminology.hl7.org/CodeSystem/diagnosis-role",
                    code: "AD",
                    display: "Admission diagnosis",
                  },
                ],
              },
            },
          ],
        },
      },
      {
        fullUrl: `urn:uuid:${conditionId}`,
        resource: {
          resourceType: "Condition",
          id: conditionId,
          clinicalStatus: {
            coding: [
              {
                system:
                  "http://terminology.hl7.org/CodeSystem/condition-clinical",
                code: "active",
              },
            ],
          },
          code: {
            coding: [
              {
                system: "http://hl7.org/fhir/sid/icd-10-cm",
                code: diagnosis.code,
                display: diagnosis.display,
              },
            ],
            text: encounter.principalDiagnosis,
          },
          subject: { reference: patientRef },
          encounter: { reference: encounterRef },
        },
      },
      {
        fullUrl: `urn:uuid:${coverageId}`,
        resource: {
          resourceType: "Coverage",
          id: coverageId,
          status: "active",
          subscriberId: encounter.coverageSnapshot.memberId,
          beneficiary: { reference: patientRef },
          payor: [
            {
              reference: payerRef,
              display: encounter.coverageSnapshot.payerName,
            },
          ],
          class: [
            {
              type: {
                coding: [
                  {
                    system:
                      "http://terminology.hl7.org/CodeSystem/coverage-class",
                    code: "plan",
                  },
                ],
              },
              value: encounter.coverageSnapshot.plan,
              name: encounter.coverageSnapshot.plan,
            },
            ...(encounter.coverageSnapshot.groupNumber
              ? [
                  {
                    type: {
                      coding: [
                        {
                          system:
                            "http://terminology.hl7.org/CodeSystem/coverage-class",
                          code: "group",
                        },
                      ],
                    },
                    value: encounter.coverageSnapshot.groupNumber,
                    name: encounter.coverageSnapshot.groupNumber,
                  },
                ]
              : []),
          ],
        },
      },
      {
        fullUrl: `urn:uuid:${facility.id}`,
        resource: {
          resourceType: "Organization",
          id: facility.id,
          name: facility.name,
          identifier: facility.npi
            ? [
                {
                  system: "http://hl7.org/fhir/sid/us-npi",
                  value: facility.npi,
                },
              ]
            : undefined,
          type: [
            {
              coding: [
                {
                  system:
                    "http://terminology.hl7.org/CodeSystem/organization-type",
                  code: "prov",
                  display: "Healthcare Provider",
                },
              ],
            },
          ],
        },
      },
      {
        fullUrl: `urn:uuid:${payerOrgId}`,
        resource: {
          resourceType: "Organization",
          id: payerOrgId,
          name: encounter.coverageSnapshot.payerName,
          identifier: [
            {
              system: "http://meridian.health/payer-type",
              value: encounter.coverageSnapshot.payerType,
            },
          ],
          type: [
            {
              coding: [
                {
                  system:
                    "http://terminology.hl7.org/CodeSystem/organization-type",
                  code: "pay",
                  display: "Payer",
                },
              ],
            },
          ],
        },
      },
      practitionerEntry(provider),
      ...(edEncounterId && edProvider && edProvider.id !== provider.id
        ? [practitionerEntry(edProvider)]
        : []),
    ],
  };
}
