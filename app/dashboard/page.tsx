import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";
import { computeDashboardMetrics } from "@/src/services/metrics/dashboard-metrics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { events, decisions, notifications, audit } = getIngestRuntime();
  const recentEvents = await events.listRecent(100);
  const decisionList = await Promise.all(
    recentEvents.map((e) => decisions.findByEventId(e.id))
  );
  const metrics = computeDashboardMetrics({
    events: recentEvents,
    decisions: decisionList.filter((d): d is NonNullable<typeof d> => Boolean(d)),
    notifications: notifications.listAll(),
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
    <AppShell title="Dashboard">
      <p className="mb-6 text-black/70 dark:text-white/70">
        Metrics derived from persisted pipeline records (process-local store in
        POC).
      </p>

      <section className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-black/10 px-4 py-3 dark:border-white/15"
          >
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
              {card.label}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <Link
            href="/audit"
            className="text-sm underline-offset-2 hover:underline"
          >
            Full audit
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="font-mono text-sm text-black/50 dark:text-white/50">
            No activity yet. POST a Bundle to /api/fhir/r4/events
          </p>
        ) : (
          <ol className="space-y-2 text-sm">
            {activity.map((entry) => (
              <li
                key={entry.id ?? `${entry.action}-${entry.timestamp}`}
                className="border-l-2 border-black/15 pl-3 dark:border-white/20"
              >
                <span className="font-medium">{entry.action}</span>{" "}
                <span className="text-black/50 dark:text-white/50">
                  ({entry.status})
                </span>
                <div className="font-mono text-xs text-black/50 dark:text-white/50">
                  {entry.timestamp}
                  {entry.correlationId ? ` · ${entry.correlationId}` : ""}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-sm">
        <Link href="/events" className="underline-offset-2 hover:underline">
          View events →
        </Link>
      </p>
    </AppShell>
  );
}
