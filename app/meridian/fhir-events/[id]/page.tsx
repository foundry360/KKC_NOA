import Link from "next/link";
import { notFound } from "next/navigation";
import { MeridianShell } from "@/components/meridian/shell";
import { formatDt } from "@/components/meridian/patient-banner";
import {
  findNotificationByEncounter,
  getFhirEvent,
  getPatient,
} from "@/src/meridian/store/runtime";

export const dynamic = "force-dynamic";

export default async function FhirEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getFhirEvent(id);
  if (!event) notFound();
  const [patient, notification] = await Promise.all([
    getPatient(event.patientId),
    findNotificationByEncounter(event.encounterId),
  ]);
  const entries = Array.isArray(
    (event.bundle as { entry?: unknown[] }).entry
  )
    ? ((event.bundle as { entry: Array<{ resource?: { resourceType?: string; id?: string } }> })
        .entry)
    : [];

  return (
    <MeridianShell title="FHIR Event">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[14px] font-semibold text-[var(--mh-navy)]">
          FHIR Event
        </h1>
        <div className="flex flex-wrap gap-2">
          {notification ? (
            <Link
              href={`/meridian/notifications/${notification.id}`}
              className="mh-btn mh-btn-secondary"
            >
              View Notification
            </Link>
          ) : null}
          <Link
            href={`/meridian/patients/${event.patientId}`}
            className="mh-btn mh-btn-secondary"
          >
            Chart
          </Link>
        </div>
      </div>

      {event.demoMode ? (
        <div className="mh-demo mb-3">Demo Mode — send used simulated NOA path</div>
      ) : null}

      <section className="mh-panel mb-3">
        <h2 className="mh-panel-title">Event metadata</h2>
        <div className="mh-panel-body grid gap-2 sm:grid-cols-3 text-[14px]">
          <Meta label="Event ID" value={event.id} mono />
          <Meta label="FHIR Version" value={event.fhirVersion} />
          <Meta label="Event Type" value={event.eventType} />
          <Meta label="Created" value={formatDt(event.createdAt)} />
          <Meta label="Status" value={event.status} />
          <Meta
            label="Correlation ID"
            value={event.correlationId ?? "—"}
            mono
          />
          <Meta
            label="Patient"
            value={
              patient
                ? `${patient.given.join(" ")} ${patient.family} (${patient.mrn})`
                : event.patientId
            }
          />
        </div>
      </section>

      <section className="mh-panel mb-3">
        <h2 className="mh-panel-title">Bundle resource tree</h2>
        <div className="mh-panel-body font-mono text-[12px]">
          <p>Bundle</p>
          <ul className="ml-4 mt-1 space-y-1">
            {entries.map((entry, i) => (
              <li key={i}>
                ├── {entry.resource?.resourceType ?? "Resource"}
                {entry.resource?.id ? `/${entry.resource.id}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mh-panel">
        <h2 className="mh-panel-title">View JSON</h2>
        <div className="mh-panel-body">
          <pre className="max-h-[480px] overflow-auto border border-[var(--mh-line)] bg-[var(--mh-row)] p-2 font-mono text-[12px]">
            {JSON.stringify(event.bundle, null, 2)}
          </pre>
          <p className="mt-2 text-[14px] text-[var(--mh-muted)]">
            Already sent to NOA Accelerator on admit
            {event.status === "FAILED"
              ? ` (send failed: ${event.sendError ?? "unknown"})`
              : "."}
          </p>
        </div>
      </section>
    </MeridianShell>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[14px] font-semibold uppercase tracking-[0.05em] text-[var(--mh-subtle)]">
        {label}
      </p>
      <p className={mono ? "break-all font-mono text-[12px]" : undefined}>
        {value}
      </p>
    </div>
  );
}
