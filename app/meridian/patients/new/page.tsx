import Link from "next/link";
import { MeridianShell } from "@/components/meridian/shell";
import { PatientRecordForm } from "@/components/meridian/patient-record-form";
import { PAYERS, PROVIDERS } from "@/src/meridian/store/runtime";

export const dynamic = "force-dynamic";

export default function NewPatientPage() {
  return (
    <MeridianShell title="Registration">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[14px] font-semibold text-[var(--mh-navy)]">
            Register New Patient
          </h1>
          <p className="text-[14px] text-[var(--mh-muted)]">
            Create a chart record before admission
          </p>
        </div>
        <Link href="/meridian" className="mh-btn mh-btn-secondary">
          Back to census
        </Link>
      </div>
      <PatientRecordForm
        mode="create"
        payers={PAYERS.map((p) => ({
          id: p.id,
          name: p.name,
          payerType: p.payerType,
        }))}
        providers={PROVIDERS.map((p) => ({
          id: p.id,
          label: `${p.name}, ${p.credentials}`,
        }))}
      />
    </MeridianShell>
  );
}
