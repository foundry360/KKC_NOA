import { AppShell } from "@/components/layout/app-shell";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default async function DestinationsPage() {
  const { destinations } = await getIngestRuntime();
  const list = await destinations.listAll();

  return (
    <AppShell title="Destinations">
      <p className="mb-6 text-black/70 dark:text-white/70">
        Downstream endpoints referenced by contracts. Adapter keys select delivery
        implementations (mock / salesforce / pega / rest).
      </p>

      <div className="space-y-4">
        {list.map((dest) => (
          <article
            key={dest.id}
            className="rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{dest.code}</h2>
              <p className="font-mono text-xs text-black/50 dark:text-white/50">
                {dest.adapterKey}
              </p>
            </div>
            <p className="mt-1 text-sm">{dest.name}</p>
            <p className="mt-2 font-mono text-xs text-black/60 dark:text-white/60">
              {dest.endpoint ?? "—"} · auth {dest.authType ?? "NONE"}
            </p>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
