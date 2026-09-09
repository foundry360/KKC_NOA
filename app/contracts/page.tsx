import { AppShell } from "@/components/layout/app-shell";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default function ContractsPage() {
  const { contracts, destinations } = getIngestRuntime();
  const versions = contracts.listAll();
  const destById = new Map(destinations.listAll().map((d) => [d.id, d]));

  return (
    <AppShell title="Contracts">
      <p className="mb-6 text-black/70 dark:text-white/70">
        Contract registry is destination-agnostic. Override golden-path routing
        with header <code className="font-mono text-xs">X-Contract-Id</code>{" "}
        (e.g. MEDICARE_NOA_SF_V1 or MEDICARE_NOA_PEGA_V1).
      </p>

      <div className="space-y-4">
        {versions.map((contract) => {
          const dest = destById.get(contract.destinationId);
          return (
            <article
              key={contract.id}
              className="rounded-lg border border-black/10 p-4 dark:border-white/15"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">{contract.contractBusinessId}</h2>
                <p className="font-mono text-xs text-black/50 dark:text-white/50">
                  v{contract.version} · {contract.payer}
                </p>
              </div>
              <p className="mt-1 text-sm">{contract.name}</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-black/50 dark:text-white/50">Destination</dt>
                  <dd>
                    {dest?.code ?? "—"} ({dest?.adapterKey ?? "—"})
                  </dd>
                </div>
                <div>
                  <dt className="text-black/50 dark:text-white/50">Transformer</dt>
                  <dd className="font-mono text-xs">{contract.transformerCode}</dd>
                </div>
                <div>
                  <dt className="text-black/50 dark:text-white/50">Transport</dt>
                  <dd>
                    {contract.transport} / {contract.payloadFormat}
                  </dd>
                </div>
                <div>
                  <dt className="text-black/50 dark:text-white/50">Retry</dt>
                  <dd className="font-mono text-xs">
                    max {contract.retryPolicy.maxAttempts}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
