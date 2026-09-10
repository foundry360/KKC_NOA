import { AppShell } from "@/components/layout/app-shell";
import {
  EmptyState,
  StatusBadge,
  TextLink,
  processingTone,
} from "@/components/ui/primitives";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const { notifications, attempts } = await getIngestRuntime();
  const list = await notifications.listAll();

  return (
    <AppShell
      title="Deliveries"
      description="Outbound notifications, attempts, and acknowledgements."
    >
      {list.length === 0 ? (
        <EmptyState>No deliveries yet.</EmptyState>
      ) : (
        <div className="space-y-3">
          {await Promise.all(
            list.map(async (n) => {
              const tries = await attempts.listByNotificationId(n.id);
              const ack = tries.find((t) => t.acknowledgement)?.acknowledgement;
              return (
                <article
                  key={n.id}
                  className="border border-line bg-surface-raised px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge
                      value={n.status}
                      tone={processingTone(n.status)}
                    />
                    <p className="font-mono text-xs text-subtle">
                      {n.adapterKey} · {tries.length} attempt(s)
                    </p>
                  </div>
                  <p className="mt-2 font-mono text-xs text-muted">
                    ack: {ack?.ackId ?? "—"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-subtle">
                    {n.correlationId}
                  </p>
                  <p className="mt-3">
                    <TextLink href={`/events/${n.eventId}`}>
                      Open event
                    </TextLink>
                  </p>
                </article>
              );
            })
          )}
        </div>
      )}
    </AppShell>
  );
}
