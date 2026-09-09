import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const { events, admissions } = getIngestRuntime();
  const recent = await events.listRecent(25);

  return (
    <AppShell title="Events">
      <p className="mb-6 text-black/70 dark:text-white/70">
        Inbound FHIR events persisted through the ingest pipeline. Persistence is
        process-local until Supabase repositories are wired.
      </p>

      {recent.length === 0 ? (
        <p className="font-mono text-sm text-black/50 dark:text-white/50">
          No events yet. POST a Bundle to /api/fhir/r4/events
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-black/50 dark:border-white/15 dark:text-white/50">
                <th className="py-2 pr-3 font-medium">Correlation</th>
                <th className="py-2 pr-3 font-medium">State</th>
                <th className="py-2 pr-3 font-medium">Class / Payer</th>
                <th className="py-2 pr-3 font-medium">Received</th>
                <th className="py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {await Promise.all(
                recent.map(async (event) => {
                  const admission = await admissions.findByEventId(event.id);
                  return (
                    <tr
                      key={event.id}
                      className="border-b border-black/5 dark:border-white/10"
                    >
                      <td className="py-3 pr-3 font-mono text-xs">
                        {event.correlationId}
                      </td>
                      <td className="py-3 pr-3">{event.processingState}</td>
                      <td className="py-3 pr-3 text-black/70 dark:text-white/70">
                        {admission
                          ? `${admission.encounter.class} / ${admission.payer.payerType ?? "—"}`
                          : "—"}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-black/60 dark:text-white/60">
                        {event.receivedAt}
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/events/${event.id}`}
                          className="text-sm underline-offset-2 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
