import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const { audit, events } = getIngestRuntime();
  const entries = await audit.listRecent(100);

  return (
    <AppShell title="Audit">
      <p className="mb-6 text-black/70 dark:text-white/70">
        Chronological processing history across all events. Start from an event
        detail page to filter by correlation ID.
      </p>

      {entries.length === 0 ? (
        <p className="font-mono text-sm text-black/50 dark:text-white/50">
          No audit records yet.
        </p>
      ) : (
        <ol className="space-y-3 text-sm">
          {await Promise.all(
            entries.map(async (entry) => {
              const event = entry.eventId
                ? await events.findById(entry.eventId)
                : null;
              return (
                <li
                  key={entry.id ?? `${entry.action}-${entry.timestamp}`}
                  className="rounded-lg border border-black/10 p-3 dark:border-white/15"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      {entry.action}{" "}
                      <span className="font-normal text-black/50 dark:text-white/50">
                        ({entry.status})
                      </span>
                    </p>
                    <p className="font-mono text-xs text-black/50 dark:text-white/50">
                      {entry.component}
                    </p>
                  </div>
                  <p className="mt-1 font-mono text-xs text-black/60 dark:text-white/60">
                    {entry.timestamp}
                    {entry.correlationId ? ` · ${entry.correlationId}` : ""}
                  </p>
                  {entry.errorMessage ? (
                    <p className="mt-1 text-black/70 dark:text-white/70">
                      {entry.errorCode}: {entry.errorMessage}
                    </p>
                  ) : null}
                  {event ? (
                    <p className="mt-2">
                      <Link
                        href={`/events/${event.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        Open event
                      </Link>
                    </p>
                  ) : null}
                </li>
              );
            })
          )}
        </ol>
      )}
    </AppShell>
  );
}
