import { beforeEach, describe, expect, it } from "vitest";
import {
  createPatient,
  dischargeEncounter,
  getActiveEncounter,
  getEncounter,
  getPatient,
  searchPatients,
  setMeridianRepository,
  updatePatient,
} from "@/src/meridian/store/runtime";
import { createMemoryMeridianRepository } from "@/src/meridian/store/repository";
import { PAYERS } from "@/src/meridian/data/seed";

describe("meridian patient EMR store", () => {
  beforeEach(() => {
    setMeridianRepository(createMemoryMeridianRepository());
  });

  it("creates, searches, updates, and discharges", async () => {
    const payer = PAYERS[0];
    const created = await createPatient({
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
    expect((await searchPatients("Nguyen")).some((p) => p.id === created.id)).toBe(true);
    expect((await searchPatients(created.mrn))[0]?.id).toBe(created.id);

    const updated = await updatePatient({
      id: created.id,
      phone: "904-555-0100",
      diagnoses: ["Asthma", "Hypertension"],
    });
    expect((await getPatient(created.id))?.phone).toBe("904-555-0100");
    expect(updated.diagnoses).toEqual(["Asthma", "Hypertension"]);

    const seedActive = await getActiveEncounter("pat-10024");
    expect(seedActive?.id).toBe("enc-seed-10024");
    await dischargeEncounter("enc-seed-10024");
    expect(await getActiveEncounter("pat-10024")).toBeNull();
    expect((await getEncounter("enc-seed-10024"))?.status).toBe("Discharged");
  });
});
