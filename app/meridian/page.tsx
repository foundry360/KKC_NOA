import Link from "next/link";
import { MeridianShell } from "@/components/meridian/shell";
import { formatDt } from "@/components/meridian/patient-banner";
import { listCensus } from "@/src/meridian/store/runtime";

export const dynamic = "force-dynamic";

export default async function MeridianCensusPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; unit?: string; class?: string; payer?: string; status?: string }>;
}) {
  const sp = await searchParams;
  let rows = listCensus();

  if (sp.q?.trim()) {
    const q = sp.q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.patient.mrn.toLowerCase().includes(q) ||
        r.patient.family.toLowerCase().includes(q) ||
        r.patient.given.join(" ").toLowerCase().includes(q)
    );
  }
  if (sp.unit) {
    rows = rows.filter((r) => r.encounter?.unit === sp.unit);
  }
  if (sp.class) {
    rows = rows.filter((r) => r.encounter?.encounterClass === sp.class);
  }
  if (sp.payer) {
    rows = rows.filter(
      (r) =>
        (r.encounter?.coverageSnapshot.payerName ?? r.patient.coverage.payerName) ===
        sp.payer
    );
  }
  if (sp.status) {
    rows = rows.filter((r) => (r.encounter?.status ?? "Pending") === sp.status);
  }

  const units = [
    ...new Set(
      listCensus()
        .map((r) => r.encounter?.unit)
        .filter(Boolean) as string[]
    ),
  ].sort();

  return (
    <MeridianShell title="Patient Census">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[14px] font-semibold text-[var(--mh-navy)]">
            Patient Census
          </h1>
          <p className="text-[14px] text-[var(--mh-muted)]">
            Meridian Jacksonville Medical Center · synthetic census
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/meridian/patients/new" className="mh-btn">
            New Patient
          </Link>
          <Link href="/meridian/encounters" className="mh-btn mh-btn-secondary">
            Encounters
          </Link>
        </div>
      </div>

      <form className="mh-panel mb-3 grid gap-2 p-2 sm:grid-cols-5">
        <div>
          <label className="mh-label" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={sp.q}
            className="mh-input"
            placeholder="Name or MRN"
          />
        </div>
        <div>
          <label className="mh-label" htmlFor="unit">
            Unit
          </label>
          <select id="unit" name="unit" defaultValue={sp.unit ?? ""} className="mh-select">
            <option value="">All</option>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mh-label" htmlFor="class">
            Encounter
          </label>
          <select
            id="class"
            name="class"
            defaultValue={sp.class ?? ""}
            className="mh-select"
          >
            <option value="">All</option>
            <option value="INPATIENT">Inpatient</option>
            <option value="OBSERVATION">Observation</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </div>
        <div>
          <label className="mh-label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={sp.status ?? ""}
            className="mh-select"
          >
            <option value="">All</option>
            <option value="Admitted">Admitted</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="mh-btn w-full">
            Apply filters
          </button>
        </div>
      </form>

      <div className="mh-panel overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>MRN</th>
              <th>Location</th>
              <th>Encounter</th>
              <th>Status</th>
              <th>Payer</th>
              <th>Admitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ patient, encounter }) => (
              <tr key={patient.id}>
                <td>
                  <Link
                    href={`/meridian/patients/${patient.id}`}
                    className="font-semibold"
                  >
                    {patient.given.join(" ")} {patient.family}
                  </Link>
                </td>
                <td className="font-mono text-[12px]">{patient.mrn}</td>
                <td>
                  {encounter
                    ? `${encounter.unit} / ${encounter.room}`
                    : "—"}
                </td>
                <td>
                  {encounter
                    ? encounter.encounterClass.charAt(0) +
                      encounter.encounterClass.slice(1).toLowerCase()
                    : "—"}
                </td>
                <td>
                  <span
                    className={
                      encounter?.status === "Admitted"
                        ? "mh-badge mh-badge-ok"
                        : "mh-badge"
                    }
                  >
                    {encounter?.status ?? "Pending"}
                  </span>
                </td>
                <td>
                  {encounter?.coverageSnapshot.payerName ??
                    patient.coverage.payerName}
                </td>
                <td className="font-mono text-[12px] text-[var(--mh-muted)]">
                  {encounter ? formatDt(encounter.admittedAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MeridianShell>
  );
}
