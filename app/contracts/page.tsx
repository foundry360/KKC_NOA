import { AppShell } from "@/components/layout/app-shell";
import { DefList, EmptyState, Panel } from "@/components/ui/primitives";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const { contracts, destinations } = await getIngestRuntime();
  const versions = await contracts.listAll();
  const destById = new Map(
    (await destinations.listAll()).map((d) => [d.id, d])
  );

  return (
    <AppShell
      title="Contracts"
      description="Destination-agnostic registry. Override routing with X-Contract-Id (e.g. MEDICARE_NOA_SF_V1)."
    >
      {versions.length === 0 ? (
        <EmptyState>No contracts seeded.</EmptyState>
      ) : (
        <div className="space-y-4">
          {versions.map((contract) => {
            const dest = destById.get(contract.destinationId);
            return (
              <Panel key={contract.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold text-foreground">
                    {contract.contractBusinessId}
                  </h2>
                  <p className="font-mono text-xs text-subtle">
                    v{contract.version} · {contract.payer}
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted">{contract.name}</p>
                <div className="mt-4">
                  <DefList
                    items={[
                      {
                        label: "Destination",
                        value: `${dest?.code ?? "—"} (${dest?.adapterKey ?? "—"})`,
                      },
                      {
                        label: "Transformer",
                        value: contract.transformerCode,
                        mono: true,
                      },
                      {
                        label: "Transport",
                        value: `${contract.transport} / ${contract.payloadFormat}`,
                      },
                      {
                        label: "Retry",
                        value: `max ${contract.retryPolicy.maxAttempts}`,
                        mono: true,
                      },
                    ]}
                  />
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
