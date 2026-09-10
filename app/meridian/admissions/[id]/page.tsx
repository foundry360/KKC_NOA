import Link from "next/link";
import { notFound } from "next/navigation";
import { MeridianShell } from "@/components/meridian/shell";
import { formatDt } from "@/components/meridian/patient-banner";
import {
  FACILITIES,
  findFhirByEncounter,
  findNotificationByEncounter,
  getEncounter,
  getPatient,
} from "@/src/meridian/store/runtime";

export const dynamic = "force-dynamic";

export default async function AdmissionConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const encounter = getEncounter(id);
  if (!encounter) notFound();
  const patient = getPatient(encounter.patientId);
  if (!patient) notFound();
  const facility = FACILITIES.find((f) => f.id === encounter.facilityId);
  const fhir = findFhirByEncounter(encounter.id);
  const notification = findNotificationByEncounter(encounter.id);

  return (
    <MeridianShell title="Admission Confirmation">
      <h1 className="mb-3 text-[14px] font-semibold text-[var(--mh-navy)]">
        Patient Successfully Admitted
      </h1>

      {notification?.demoMode ? (
        <div className="mh-demo mb-3">
          Demo Mode — NOA Accelerator response was simulated
          {notification.timeline[0] ? "" : ""}. Integration path still ends at
          FHIR → NOA; results are labeled.
        </div>
      ) : null}

      <section className="mh-panel mb-3">
        <h2 className="mh-panel-title">Admission</h2>
        <div className="mh-panel-body space-y-1 text-[14px]">
          <p className="text-[14px] font-semibold">
            {patient.given.join(" ")} {patient.family}
          </p>
          <p className="font-mono text-[12px]">{patient.mrn}</p>
          <p className="mt-2 font-semibold">
            {encounter.encounterClass} Admission
          </p>
          <p>{facility?.name}</p>
          <p>
            {encounter.unit} / Room {encounter.room}
          </p>
          <p>Admission: {formatDt(encounter.admittedAt)}</p>
          <p>
            Primary Payer: {encounter.coverageSnapshot.payerName}
            {encounter.coverageSnapshot.plan
              ? ` — ${encounter.coverageSnapshot.plan}`
              : ""}
          </p>
          <p>Diagnosis: {encounter.principalDiagnosis}</p>
        </div>
      </section>

      <section className="mh-panel mb-3">
        <h2 className="mh-panel-title">Notification</h2>
        <div className="mh-panel-body space-y-2 text-[14px]">
          <p className="font-semibold">Admission notification initiated</p>
          <ul className="space-y-1">
            <li>
              FHIR Event{" "}
              <span className="mh-badge mh-badge-ok">
                {fhir?.status === "SENT" ? "Created + Sent" : fhir?.status ?? "—"}
              </span>
            </li>
            <li>
              NOA Processing{" "}
              <span
                className={
                  notification?.processingState === "ACKNOWLEDGED"
                    ? "mh-badge mh-badge-ok"
                    : "mh-badge mh-badge-warn"
                }
              >
                {notification?.processingState ?? "In Progress"}
              </span>
            </li>
          </ul>
          {notification ? (
            <p className="font-mono text-[14px] text-[var(--mh-muted)]">
              Correlation: {notification.correlationId}
            </p>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {fhir ? (
          <Link href={`/meridian/fhir-events/${fhir.id}`} className="mh-btn">
            View FHIR Event
          </Link>
        ) : null}
        {notification ? (
          <Link
            href={`/meridian/notifications/${notification.id}`}
            className="mh-btn mh-btn-secondary"
          >
            View Notification
          </Link>
        ) : null}
        <Link
          href={`/meridian/patients/${patient.id}`}
          className="mh-btn mh-btn-secondary"
        >
          Return to chart
        </Link>
      </div>
    </MeridianShell>
  );
}
