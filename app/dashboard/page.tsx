import { AppShell } from "@/components/layout/app-shell";
import {
  EmptyState,
  MetricGrid,
  Section,
  StatusBadge,
  TextLink,
} from "@/components/ui/primitives";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";
import { computeDashboardMetrics } from "@/src/services/metrics/dashboard-metrics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { events, decisions, notifications, audit } = await getIngestRuntime();
  const recentEvents = await events.listRecent(100);
  const decisionList = await Promise.all(
    recentEvents.map((e) => decisions.findByEventId(e.id))
  );
  const metrics = computeDashboardMetrics({
    events: recentEvents,
    decisions: decisionList.filter((d): d is NonNullable<typeof d> => Boolean(d)),
    notifications: await notifications.listAll(),
  });
  const activity = await audit.listRecent(12);

  const cards = [
    { label: "Events Received", value: metrics.eventsReceived },
    { label: "Events Processed", value: metrics.eventsProcessed },
    { label: "NOAs Generated", value: metrics.noasGenerated },
    { label: "Delivered", value: metrics.delivered },
    { label: "Failed", value: metrics.failed },
    { label: "Pending", value: metrics.pending },
  ] as const;

  return (
    <AppShell
      title="Dashboard"
      description="Operational snapshot from the ingest pipeline store."
    >
      <Section title="Metrics">
        <MetricGrid items={cards} />
      </Section>

      <Section
        title="Recent activity"
        action={<TextLink href="/audit">Full audit</TextLink>}
      >
        {activity.length === 0 ? (
          <EmptyState>
            No activity yet. POST a Bundle to /api/fhir/r4/events
          </EmptyState>
        ) : (
          <ol className="space-y-3">
            {activity.map((entry) => (
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
                  {entry.timestamp}
                  {entry.correlationId ? ` · ${entry.correlationId}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <TextLink href="/events">View events →</TextLink>
    </AppShell>
  );
}
