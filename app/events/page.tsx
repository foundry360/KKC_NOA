import { AppShell } from "@/components/layout/app-shell";
import {
  EmptyState,
  StatusBadge,
  TextLink,
  processingTone,
} from "@/components/ui/primitives";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const { events, admissions, decisions } = await getIngestRuntime();
  const recent = await events.listRecent(25);

  return (
    <AppShell
      title="Events"
      description="Inbound FHIR admissions and their processing outcomes."
    >
      {recent.length === 0 ? (
        <EmptyState>
          No events yet. POST a Bundle to /api/fhir/r4/events
        </EmptyState>
      ) : (
        <div className="overflow-x-auto border border-line bg-surface-raised">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-[0.7rem] uppercase tracking-[0.12em] text-subtle">
                <th className="px-4 py-3 font-semibold">Correlation</th>
                <th className="px-4 py-3 font-semibold">State</th>
                <th className="px-4 py-3 font-semibold">Decision</th>
                <th className="px-4 py-3 font-semibold">Class / Payer</th>
                <th className="px-4 py-3 font-semibold">Received</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {await Promise.all(
                recent.map(async (event) => {
                  const admission = await admissions.findByEventId(event.id);
                  const decision = await decisions.findByEventId(event.id);
                  return (
                    <tr
                      key={event.id}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {event.correlationId}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          value={event.processingState}
                          tone={processingTone(event.processingState)}
                        />
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {decision?.decision ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {admission
                          ? `${admission.encounter.class} / ${admission.payer.payerType ?? "—"}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-subtle">
                        {event.receivedAt}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TextLink href={`/events/${event.id}`}>View</TextLink>
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
