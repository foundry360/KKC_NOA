import Link from "next/link";
import { notFound } from "next/navigation";
import { MeridianShell } from "@/components/meridian/shell";
import {
  findFhirByEncounter,
  getEncounter,
  getNotification,
  getPatient,
} from "@/src/meridian/store/runtime";

export const dynamic = "force-dynamic";

export default async function NotificationStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const notification = getNotification(id);
  if (!notification) notFound();
  const patient = getPatient(notification.patientId);
  const encounter = getEncounter(notification.encounterId);
  const fhir = findFhirByEncounter(notification.encounterId);

  return (
    <MeridianShell title="Admission Notification">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[14px] font-semibold text-[var(--mh-navy)]">
          Admission Notification
        </h1>
        <div className="flex flex-wrap gap-2">
          {fhir ? (
            <Link
              href={`/meridian/fhir-events/${fhir.id}`}
              className="mh-btn mh-btn-secondary"
            >
              View FHIR Event
            </Link>
          ) : null}
          <Link
            href={`/meridian/notifications/${id}/response`}
            className="mh-btn mh-btn-secondary"
          >
            Payer Response
          </Link>
          <Link
            href={`/meridian/patients/${notification.patientId}`}
            className="mh-btn mh-btn-secondary"
          >
            Chart
          </Link>
        </div>
      </div>

      {notification.demoMode ? (
        <div className="mh-demo mb-3">
          Demo Mode — timeline may include simulated NOA steps
        </div>
      ) : null}

      <section className="mh-panel mb-3">
        <h2 className="mh-panel-title">Context</h2>
        <div className="mh-panel-body grid gap-2 sm:grid-cols-2 text-[14px]">
          <p>
            <span className="text-[var(--mh-subtle)]">Patient</span>
            <br />
            {patient
              ? `${patient.given.join(" ")} ${patient.family}`
              : notification.patientId}
          </p>
          <p>
            <span className="text-[var(--mh-subtle)]">Admission</span>
            <br />
            {encounter?.encounterClass ?? "—"}
          </p>
          <p>
            <span className="text-[var(--mh-subtle)]">Payer</span>
            <br />
            {encounter?.coverageSnapshot.payerName ?? "—"}
          </p>
          <p>
            <span className="text-[var(--mh-subtle)]">Correlation ID</span>
            <br />
            <span className="font-mono text-[14px]">
              {notification.correlationId}
            </span>
          </p>
        </div>
      </section>

      <section className="mh-panel">
        <h2 className="mh-panel-title">Processing timeline</h2>
        <div className="mh-panel-body">
          <ol className="space-y-2">
            {notification.timeline.map((step) => (
              <li
                key={step.step}
                className="flex items-center justify-between border-b border-[var(--mh-line)] py-1.5 text-[14px] last:border-b-0"
              >
                <span>{step.step}</span>
                <span
                  className={
                    step.status === "done"
                      ? "mh-badge mh-badge-ok"
                      : step.status === "failed"
                        ? "mh-badge mh-badge-danger"
                        : "mh-badge"
                  }
                >
                  {step.status === "done"
                    ? "✓"
                    : step.status === "failed"
                      ? "✗"
                      : "●"}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[14px] text-[var(--mh-muted)]">
            Decision/delivery owned by NOA Accelerator
            {notification.decision ? ` · ${notification.decision}` : ""}
            {notification.adapterKey ? ` · adapter ${notification.adapterKey}` : ""}
            {notification.acknowledgement?.ackId
              ? ` · ack ${notification.acknowledgement.ackId}`
              : ""}
          </p>
        </div>
      </section>
    </MeridianShell>
  );
}
