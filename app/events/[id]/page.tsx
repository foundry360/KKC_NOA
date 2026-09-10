import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import {
  CodeBlock,
  DefList,
  Panel,
  Section,
  StatusBadge,
  TextLink,
  processingTone,
} from "@/components/ui/primitives";
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
  } = await getIngestRuntime();
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
    <AppShell
      title="Event Detail"
      description="End-to-end journey for one admission event."
    >
      <p className="mb-8">
        <TextLink href="/events">← Events</TextLink>
      </p>

      <Section title="Event">
        <Panel>
          <div className="mb-4">
            <StatusBadge
              value={event.processingState}
              tone={processingTone(event.processingState)}
            />
          </div>
          <DefList
            items={[
              { label: "Event ID", value: event.id, mono: true },
              {
                label: "Correlation ID",
                value: event.correlationId,
                mono: true,
              },
              { label: "Source", value: event.sourceSystemCode ?? "—" },
              { label: "Received", value: event.receivedAt, mono: true },
              { label: "Content type", value: event.contentType, wide: true },
            ]}
          />
        </Panel>
      </Section>

      <Section title="Canonical AdmissionEvent">
        {admission ? (
          <div className="space-y-4">
            <Panel>
              <DefList
                items={[
                  {
                    label: "Patient",
                    value: `${admission.patient.name.given?.join(" ") ?? ""} ${admission.patient.name.family ?? ""}`.trim(),
                  },
                  {
                    label: "Encounter class",
                    value: admission.encounter.class,
                  },
                  {
                    label: "Admission",
                    value: admission.admission.admissionDateTime ?? "—",
                    mono: true,
                  },
                  { label: "Facility", value: admission.facility.name ?? "—" },
                  {
                    label: "Payer",
                    value: `${admission.payer.name ?? "—"} (${admission.payer.payerType ?? "—"})`,
                  },
                  {
                    label: "Coverage",
                    value:
                      admission.coverage.plan ??
                      admission.coverage.status ??
                      "—",
                  },
                ]}
              />
            </Panel>
            <CodeBlock>{JSON.stringify(admission, null, 2)}</CodeBlock>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Not available ({event.processingState}
            {event.errorSummary ? ` — ${event.errorSummary}` : ""})
          </p>
        )}
      </Section>

      <Section title="Decision">
        {decision ? (
          <Panel>
            <DefList
              items={[
                { label: "Decision", value: decision.decision },
                {
                  label: "NOA required",
                  value: decision.notificationRequired ? "Yes" : "No",
                },
                {
                  label: "Type / Priority",
                  value: `${decision.notificationType ?? "—"} / ${decision.priority ?? "—"}`,
                },
                {
                  label: "Rules applied",
                  value: decision.rulesApplied.length
                    ? decision.rulesApplied.join(", ")
                    : "—",
                  mono: true,
                },
                {
                  label: "Rule versions",
                  value: decision.ruleVersions.length
                    ? decision.ruleVersions.join(", ")
                    : "—",
                  mono: true,
                  wide: true,
                },
              ]}
            />
            {execution ? (
              <div className="mt-4">
                <p className="mb-2 text-xs uppercase tracking-[0.1em] text-subtle">
                  Execution input snapshot
                </p>
                <CodeBlock>
                  {JSON.stringify(execution.inputSnapshot, null, 2)}
                </CodeBlock>
              </div>
            ) : null}
          </Panel>
        ) : (
          <p className="text-sm text-muted">No decision recorded for this event.</p>
        )}
      </Section>

      <Section title="Contract / Routing">
        {selection ? (
          <Panel>
            <DefList
              items={[
                {
                  label: "Contract",
                  value: selection.contractBusinessId,
                  mono: true,
                },
                { label: "Destination", value: selection.destinationCode },
                { label: "Adapter", value: selection.adapterKey },
                {
                  label: "Transformer",
                  value: selection.transformerCode,
                  mono: true,
                },
              ]}
            />
          </Panel>
        ) : (
          <p className="text-sm text-muted">
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
      </Section>

      <Section title="Transformation">
        {transform ? (
          <div className="space-y-3">
            <p className="font-mono text-xs text-muted">
              {transform.transformerCode}@v{transform.transformerVersion}
            </p>
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.1em] text-subtle">
                Destination payload
              </p>
              <CodeBlock>{JSON.stringify(transform.payload, null, 2)}</CodeBlock>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.1em] text-subtle">
                Mapping trace
              </p>
              <CodeBlock>
                {JSON.stringify(transform.mappingTrace, null, 2)}
              </CodeBlock>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No destination payload
            {event.processingState === "TRANSFORM_FAILED"
              ? " (TRANSFORM_FAILED)"
              : ""}
            .
          </p>
        )}
      </Section>

      <Section title="Delivery">
        {notification ? (
          <div className="space-y-3">
            <Panel>
              <DefList
                items={[
                  { label: "Status", value: notification.status },
                  { label: "Adapter", value: notification.adapterKey },
                  {
                    label: "Attempts",
                    value: String(deliveryAttempts.length),
                  },
                  {
                    label: "Ack ID",
                    value:
                      deliveryAttempts.find((a) => a.acknowledgement)
                        ?.acknowledgement?.ackId ?? "—",
                    mono: true,
                  },
                ]}
              />
            </Panel>
            <CodeBlock>
              {JSON.stringify(deliveryAttempts, null, 2)}
            </CodeBlock>
          </div>
        ) : (
          <p className="text-sm text-muted">No delivery recorded.</p>
        )}
      </Section>

      <Section title="Audit">
        <ol className="space-y-3">
          {trail.map((entry) => (
            <li
              key={entry.id ?? `${entry.action}-${entry.timestamp}`}
              className="border-l-2 border-accent/40 pl-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{entry.action}</span>
                <StatusBadge
                  value={entry.status}
                  tone={
                    entry.status === "SUCCESS"
                      ? "success"
                      : entry.status === "FAILURE"
                        ? "danger"
                        : "neutral"
                  }
                />
              </div>
              <p className="mt-1 font-mono text-xs text-subtle">
                {entry.timestamp} · {entry.component}
              </p>
            </li>
          ))}
        </ol>
      </Section>
    </AppShell>
  );
}
