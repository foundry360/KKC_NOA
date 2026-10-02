import Link from "next/link";
import { MeridianShell } from "@/components/meridian/shell";
import { formatDt } from "@/components/meridian/patient-banner";
import {
  FACILITIES,
  listEncounters,
  searchPatients,
} from "@/src/meridian/store/runtime";

export const dynamic = "force-dynamic";

export default async function EncountersPage() {
  const [encounters, patients] = await Promise.all([
    listEncounters(),
    searchPatients(""),
  ]);
  const patientById = new Map(patients.map((p) => [p.id, p]));

  return (
    <MeridianShell title="Encounters">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[14px] font-semibold text-[var(--mh-navy)]">
            Encounters / Admissions
          </h1>
          <p className="text-[14px] text-[var(--mh-muted)]">
            Active and historical encounters
          </p>
        </div>
        <Link href="/meridian/patients/new" className="mh-btn">
          New Patient
        </Link>
      </div>

      <div className="mh-panel overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>MRN</th>
              <th>Class</th>
              <th>Status</th>
              <th>Location</th>
              <th>Facility</th>
              <th>Admitted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {encounters.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-[var(--mh-muted)]">
                  No encounters yet. Admit a patient from their chart.
                </td>
              </tr>
            ) : (
              encounters.map((enc) => {
                const patient = patientById.get(enc.patientId);
                const facility = FACILITIES.find((f) => f.id === enc.facilityId);
                return (
                  <tr key={enc.id}>
                    <td>
                      {patient ? (
                        <Link
                          href={`/meridian/patients/${patient.id}`}
                          className="font-semibold"
                        >
                          {patient.given.join(" ")} {patient.family}
                        </Link>
                      ) : (
                        enc.patientId
                      )}
                    </td>
                    <td className="font-mono text-[12px]">
                      {patient?.mrn ?? "—"}
                    </td>
                    <td>{enc.encounterClass}</td>
                    <td>
                      <span
                        className={
                          enc.status === "Admitted" || enc.status === "Active"
                            ? "mh-badge mh-badge-ok"
                            : enc.status === "Discharged"
                              ? "mh-badge"
                              : "mh-badge mh-badge-warn"
                        }
                      >
                        {enc.status}
                      </span>
                    </td>
                    <td>
                      {enc.unit} / {enc.room}
                    </td>
                    <td>{facility?.name ?? "—"}</td>
                    <td className="font-mono text-[12px]">
                      {formatDt(enc.admittedAt)}
                    </td>
                    <td>
                      {patient ? (
                        <Link href={`/meridian/patients/${patient.id}/admit`}>
                          Re-admit
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </MeridianShell>
  );
}
