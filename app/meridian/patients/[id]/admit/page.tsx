import Link from "next/link";
import { notFound } from "next/navigation";
import { MeridianShell } from "@/components/meridian/shell";
import { PatientBanner } from "@/components/meridian/patient-banner";
import { AdmitForm } from "./admit-form";
import {
  DEPARTMENTS,
  FACILITIES,
  PAYERS,
  PROVIDERS,
  getActiveEncounter,
  getPatient,
} from "@/src/meridian/store/runtime";

export const dynamic = "force-dynamic";

export default async function AdmitPage({
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
      title="Admit Patient"
      banner={<PatientBanner patient={patient} encounter={encounter} />}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-[14px] font-semibold text-[var(--mh-navy)]">
            Admit Patient
          </h1>
          <p className="text-[14px] text-[var(--mh-muted)]">
            Registration / clinical admission · FHIR generated on submit
          </p>
        </div>
        <Link
          href={`/meridian/patients/${id}`}
          className="mh-btn mh-btn-secondary"
        >
          Back to chart
        </Link>
      </div>

      <AdmitForm
        patient={patient}
        facilities={FACILITIES.map((f) => ({ id: f.id, name: f.name }))}
        departments={DEPARTMENTS.map((d) => ({
          id: d.id,
          name: d.name,
          facilityId: d.facilityId,
        }))}
        providers={PROVIDERS.map((p) => ({
          id: p.id,
          label: `${p.name}, ${p.credentials}`,
        }))}
        payers={PAYERS.map((p) => ({
          id: p.id,
          name: p.name,
          payerType: p.payerType,
        }))}
      />
    </MeridianShell>
  );
}
