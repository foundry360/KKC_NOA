import { AppShell } from "@/components/layout/app-shell";
import {
  EmptyState,
  StatusBadge,
  TextLink,
} from "@/components/ui/primitives";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const { audit, events } = await getIngestRuntime();
  const entries = await audit.listRecent(100);

  return (
    <AppShell
      title="Audit"
      description="Chronological processing history. Use Event Detail to filter by correlation ID."
    >
      {entries.length === 0 ? (
        <EmptyState>No audit records yet.</EmptyState>
      ) : (
        <ol className="space-y-3">
          {await Promise.all(
            entries.map(async (entry) => {
              const event = entry.eventId
                ? await events.findById(entry.eventId)
                : null;
              return (
                <li
                  key={entry.id ?? `${entry.action}-${entry.timestamp}`}
                  className="border border-line bg-surface-raised px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
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
                    <p className="font-mono text-xs text-subtle">
                      {entry.component}
                    </p>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {entry.timestamp}
                    {entry.correlationId ? ` · ${entry.correlationId}` : ""}
                  </p>
                  {entry.errorMessage ? (
                    <p className="mt-2 text-sm text-danger">
                      {entry.errorCode}: {entry.errorMessage}
                    </p>
                  ) : null}
                  {event ? (
                    <p className="mt-3">
                      <TextLink href={`/events/${event.id}`}>
                        Open event
                      </TextLink>
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
