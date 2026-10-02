"use server";

import {
  admitPatient,
  createPatient,
  dischargeEncounter,
  searchPatients,
  submitAdmissionToSalesforce,
  updatePatient,
} from "@/src/meridian/store/runtime";
import type {
  AdmitInput,
  CreatePatientInput,
  UpdatePatientInput,
} from "@/src/meridian/types";

export async function admitPatientAction(input: AdmitInput) {
  try {
    const result = await admitPatient(input);
    return {
      ok: true as const,
      encounterId: result.encounter.id,
      fhirEventId: result.fhirEvent.id,
      notificationId: result.notification.id,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Admission failed",
    };
  }
}

export async function submitAdmissionToSalesforceAction(admissionId: string) {
  try {
    const { outcome, record } = await submitAdmissionToSalesforce(admissionId);
    return {
      ok: true as const,
      outcome,
      status: record.status,
      salesforceRecordId: record.salesforceRecordId,
      errorMessage: record.errorMessage,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Salesforce submission failed",
    };
  }
}

export async function createPatientAction(input: CreatePatientInput) {
  try {
    const patient = await createPatient(input);
    return { ok: true as const, patientId: patient.id, mrn: patient.mrn };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Could not create patient",
    };
  }
}

export async function updatePatientAction(input: UpdatePatientInput) {
  try {
    const patient = await updatePatient(input);
    return { ok: true as const, patientId: patient.id };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Could not update patient",
    };
  }
}

export async function dischargeEncounterAction(encounterId: string) {
  try {
    const encounter = await dischargeEncounter(encounterId);
    return { ok: true as const, encounterId: encounter.id };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Discharge failed",
    };
  }
}

export async function searchPatientsAction(query: string) {
  const matches = (await searchPatients(query)).slice(0, 8);
  return matches.map((p) => ({
    id: p.id,
    mrn: p.mrn,
    name: `${p.given.join(" ")} ${p.family}`,
  }));
}
