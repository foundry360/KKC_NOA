import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const { notifications, attempts } = getIngestRuntime();
  const list = notifications.listAll();

  return (
    <AppShell title="Deliveries">
      <p className="mb-6 text-black/70 dark:text-white/70">
        Outbound notifications, delivery attempts, acknowledgements, and dead
        letters.
      </p>

      {list.length === 0 ? (
        <p className="font-mono text-sm text-black/50 dark:text-white/50">
          No deliveries yet.
        </p>
      ) : (
        <div className="space-y-3">
          {await Promise.all(
            list.map(async (n) => {
              const tries = await attempts.listByNotificationId(n.id);
              const ack = tries.find((t) => t.acknowledgement)?.acknowledgement;
              return (
                <article
                  key={n.id}
                  className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/15"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{n.status}</p>
                    <p className="font-mono text-xs text-black/50 dark:text-white/50">
                      {n.adapterKey} · {tries.length} attempt(s)
                    </p>
                  </div>
                  <p className="mt-1 font-mono text-xs">
                    ack: {ack?.ackId ?? "—"}
                  </p>
                  <p className="mt-2">
                    <Link
                      href={`/events/${n.eventId}`}
                      className="underline-offset-2 hover:underline"
                    >
                      View event
                    </Link>
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
