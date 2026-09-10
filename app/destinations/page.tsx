import { AppShell } from "@/components/layout/app-shell";
import { DefList, EmptyState, Panel } from "@/components/ui/primitives";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default async function DestinationsPage() {
  const { destinations } = await getIngestRuntime();
  const list = await destinations.listAll();

  return (
    <AppShell
      title="Destinations"
      description="Downstream endpoints. Adapter keys select mock / salesforce / pega / rest."
    >
      {list.length === 0 ? (
        <EmptyState>No destinations seeded.</EmptyState>
      ) : (
        <div className="space-y-4">
          {list.map((dest) => (
            <Panel key={dest.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-foreground">{dest.name}</h2>
                <p className="font-mono text-xs text-subtle">{dest.code}</p>
              </div>
              <div className="mt-4">
                <DefList
                  items={[
                    { label: "Adapter", value: dest.adapterKey },
                    {
                      label: "Endpoint",
                      value: dest.endpoint ?? "—",
                      mono: true,
                    },
                    { label: "Auth", value: dest.authType ?? "NONE" },
                    {
                      label: "Active",
                      value: dest.active ? "Yes" : "No",
                    },
                  ]}
                />
              </div>
            </Panel>
          ))}
        </div>
      )}
    </AppShell>
  );
}
