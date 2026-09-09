import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const {
    events,
    admissions,
    audit,
    decisions,
    executions,
    selections,
    transformResults,
    notifications,
    attempts,
  } = getIngestRuntime();
  const event = await events.findById(id);
  if (!event) notFound();

  const admission = await admissions.findByEventId(event.id);
  const decision = await decisions.findByEventId(event.id);
  const execution = await executions.findByEventId(event.id);
  const selection = await selections.findByEventId(event.id);
  const transform = await transformResults.findByEventId(event.id);
  const notification = await notifications.findByEventId(event.id);
  const deliveryAttempts = notification
    ? await attempts.listByNotificationId(notification.id)
    : [];
  const trail = await audit.listByCorrelationId(event.correlationId);

  return (
    <AppShell title="Event Detail">
      <p className="mb-6">
        <Link href="/events" className="text-sm underline-offset-2 hover:underline">
          ← Events
        </Link>
      </p>

      <section className="mb-8 space-y-2">
        <h2 className="text-lg font-semibold">Event</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-black/50 dark:text-white/50">Event ID</dt>
            <dd className="font-mono text-xs">{event.id}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Correlation ID</dt>
            <dd className="font-mono text-xs">{event.correlationId}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Source</dt>
            <dd>{event.sourceSystemCode ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Processing state</dt>
            <dd>{event.processingState}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Received</dt>
            <dd className="font-mono text-xs">{event.receivedAt}</dd>
          </div>
          <div>
            <dt className="text-black/50 dark:text-white/50">Content type</dt>
            <dd>{event.contentType}</dd>
          </div>
        </dl>
      </section>

      {admission ? (
        <section className="mb-8 space-y-2">
          <h2 className="text-lg font-semibold">Canonical AdmissionEvent</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-black/50 dark:text-white/50">Patient</dt>
              <dd>
                {admission.patient.name.given?.join(" ")}{" "}
                {admission.patient.name.family}
              </dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">Encounter class</dt>
              <dd>{admission.encounter.class}</dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">Admission</dt>
              <dd className="font-mono text-xs">
                {admission.admission.admissionDateTime}
              </dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">Facility</dt>
              <dd>{admission.facility.name}</dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">Payer</dt>
              <dd>
                {admission.payer.name} ({admission.payer.payerType})
              </dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">Coverage</dt>
              <dd>{admission.coverage.plan ?? admission.coverage.status}</dd>
            </div>
          </dl>
          <pre className="mt-4 overflow-x-auto rounded-md bg-black/[0.04] p-3 font-mono text-xs dark:bg-white/[0.06]">
            {JSON.stringify(admission, null, 2)}
          </pre>
        </section>
      ) : (
        <section className="mb-8">
          <h2 className="text-lg font-semibold">Canonical AdmissionEvent</h2>
          <p className="text-sm text-black/60 dark:text-white/60">
            Not available ({event.processingState}
            {event.errorSummary ? ` — ${event.errorSummary}` : ""})
          </p>
        </section>
      )}

      <section className="mb-8 space-y-2">
        <h2 className="text-lg font-semibold">Decision</h2>
        {decision ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-black/50 dark:text-white/50">Decision</dt>
              <dd className="font-medium">{decision.decision}</dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">NOA required</dt>
              <dd>{decision.notificationRequired ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">Type / Priority</dt>
              <dd>
                {decision.notificationType ?? "—"} / {decision.priority ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">Rules applied</dt>
              <dd className="font-mono text-xs">
                {decision.rulesApplied.length
                  ? decision.rulesApplied.join(", ")
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-black/50 dark:text-white/50">Rule versions</dt>
              <dd className="font-mono text-xs">
                {decision.ruleVersions.length
                  ? decision.ruleVersions.join(", ")
                  : "—"}
              </dd>
            </div>
            {execution ? (
              <div className="sm:col-span-2">
                <dt className="text-black/50 dark:text-white/50">
                  Execution input snapshot
                </dt>
                <dd>
                  <pre className="mt-1 overflow-x-auto rounded-md bg-black/[0.04] p-3 font-mono text-xs dark:bg-white/[0.06]">
                    {JSON.stringify(execution.inputSnapshot, null, 2)}
                  </pre>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-black/60 dark:text-white/60">
            No decision recorded for this event.
          </p>
        )}
      </section>

      <section className="mb-8 space-y-2">
        <h2 className="text-lg font-semibold">Contract / Routing</h2>
        {selection ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-black/50 dark:text-white/50">Contract</dt>
              <dd className="font-mono text-xs">{selection.contractBusinessId}</dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">Destination</dt>
              <dd>{selection.destinationCode}</dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">Adapter</dt>
              <dd>{selection.adapterKey}</dd>
            </div>
            <div>
              <dt className="text-black/50 dark:text-white/50">Transformer</dt>
              <dd className="font-mono text-xs">{selection.transformerCode}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-black/60 dark:text-white/60">
            No contract selected
            {event.processingState === "NO_CONTRACT"
              ? " (NO_CONTRACT)"
              : event.processingState === "EVALUATED" &&
                  decision?.decision === "NO_NOA_REQUIRED"
                ? " (NOA not required)"
                : ""}
            .
          </p>
        )}
      </section>

      <section className="mb-8 space-y-2">
        <h2 className="text-lg font-semibold">Transformation</h2>
        {transform ? (
          <div className="space-y-3 text-sm">
            <p className="font-mono text-xs text-black/60 dark:text-white/60">
              {transform.transformerCode}@v{transform.transformerVersion}
            </p>
            <div>
              <p className="mb-1 text-black/50 dark:text-white/50">
                Destination payload
              </p>
              <pre className="overflow-x-auto rounded-md bg-black/[0.04] p-3 font-mono text-xs dark:bg-white/[0.06]">
                {JSON.stringify(transform.payload, null, 2)}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-black/50 dark:text-white/50">
                Mapping trace
              </p>
              <pre className="overflow-x-auto rounded-md bg-black/[0.04] p-3 font-mono text-xs dark:bg-white/[0.06]">
                {JSON.stringify(transform.mappingTrace, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-black/60 dark:text-white/60">
            No destination payload
            {event.processingState === "TRANSFORM_FAILED"
              ? " (TRANSFORM_FAILED)"
              : ""}
            .
          </p>
        )}
      </section>

      <section className="mb-8 space-y-2">
        <h2 className="text-lg font-semibold">Delivery</h2>
        {notification ? (
          <div className="space-y-3 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-black/50 dark:text-white/50">Status</dt>
                <dd>{notification.status}</dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">Adapter</dt>
                <dd>{notification.adapterKey}</dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">Attempts</dt>
                <dd>{deliveryAttempts.length}</dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">Ack ID</dt>
                <dd className="font-mono text-xs">
                  {deliveryAttempts.find((a) => a.acknowledgement)?.acknowledgement
                    ?.ackId ?? "—"}
                </dd>
              </div>
            </dl>
            <pre className="overflow-x-auto rounded-md bg-black/[0.04] p-3 font-mono text-xs dark:bg-white/[0.06]">
              {JSON.stringify(deliveryAttempts, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-black/60 dark:text-white/60">
            No delivery recorded.
          </p>
        )}
      </section>

      <section className="mb-8 space-y-2">
        <h2 className="text-lg font-semibold">Audit</h2>
        <ol className="space-y-2 text-sm">
          {trail.map((entry) => (
            <li
              key={entry.id ?? `${entry.action}-${entry.timestamp}`}
              className="flex flex-col gap-0.5 border-l-2 border-black/15 pl-3 dark:border-white/20"
            >
              <span className="font-medium">
                {entry.action}{" "}
                <span className="font-normal text-black/50 dark:text-white/50">
                  ({entry.status})
                </span>
              </span>
              <span className="font-mono text-xs text-black/50 dark:text-white/50">
                {entry.timestamp} · {entry.component}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
