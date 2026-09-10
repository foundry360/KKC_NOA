import { beforeEach, describe, expect, it } from "vitest";
import {
  createPatient,
  dischargeEncounter,
  getActiveEncounter,
  getMeridianStore,
  getPatient,
  searchPatients,
  updatePatient,
} from "@/src/meridian/store/runtime";
import { PAYERS } from "@/src/meridian/data/seed";

describe("meridian patient EMR store", () => {
  beforeEach(() => {
    const g = globalThis as typeof globalThis & {
      __meridianStore?: unknown;
      __meridianStoreVersion?: number;
    };
    delete g.__meridianStore;
    delete g.__meridianStoreVersion;
    getMeridianStore();
  });

  it("creates, searches, updates, and discharges", () => {
    const payer = PAYERS[0];
    const created = createPatient({
      family: "Nguyen",
      given: ["Linh"],
      sex: "female",
      birthDate: "1988-04-12",
      address: {
        line: ["100 Riverside Ave"],
        city: "Jacksonville",
        state: "FL",
        postalCode: "32204",
      },
      coverage: {
        payerId: payer.id,
        payerName: payer.name,
        payerType: payer.payerType,
        plan: "Test PPO",
        memberId: "MEM-TEST-1",
        coverageType: "Primary",
      },
      diagnoses: ["Asthma"],
    });

    expect(created.mrn).toMatch(/^MRN-\d+$/);
    expect(searchPatients("Nguyen").some((p) => p.id === created.id)).toBe(
      true
    );
    expect(searchPatients(created.mrn)[0]?.id).toBe(created.id);

    const updated = updatePatient({
      id: created.id,
      phone: "904-555-0100",
      diagnoses: ["Asthma", "Hypertension"],
    });
    expect(getPatient(created.id)?.phone).toBe("904-555-0100");
    expect(updated.diagnoses).toEqual(["Asthma", "Hypertension"]);

    const store = getMeridianStore();
    const seedActive = [...store.activeEncounterByPatient.entries()][0];
    if (seedActive) {
      const [patientId, encId] = seedActive;
      expect(getActiveEncounter(patientId)?.id).toBe(encId);
      dischargeEncounter(encId);
      expect(getActiveEncounter(patientId)).toBeNull();
      expect(store.encounters.get(encId)?.status).toBe("Discharged");
    }
  });
});
