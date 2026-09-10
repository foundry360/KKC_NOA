import Link from "next/link";
import { notFound } from "next/navigation";
import { MeridianShell } from "@/components/meridian/shell";
import { PatientBanner } from "@/components/meridian/patient-banner";
import { PatientRecordForm } from "@/components/meridian/patient-record-form";
import {
  PAYERS,
  PROVIDERS,
  getActiveEncounter,
  getPatient,
} from "@/src/meridian/store/runtime";

export const dynamic = "force-dynamic";

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = getPatient(id);
  if (!patient) notFound();
  const encounter = getActiveEncounter(id);

  return (
    <MeridianShell
      title="Edit Chart"
      banner={<PatientBanner patient={patient} encounter={encounter} />}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[14px] font-semibold text-[var(--mh-navy)]">
            Manage Patient Record
          </h1>
          <p className="text-[14px] text-[var(--mh-muted)]">
            Demographics, coverage, and clinical context
          </p>
        </div>
        <Link
          href={`/meridian/patients/${id}`}
          className="mh-btn mh-btn-secondary"
        >
          Back to chart
        </Link>
      </div>
      <PatientRecordForm
        mode="edit"
        patient={patient}
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
