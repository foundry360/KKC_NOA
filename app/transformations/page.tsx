import { AppShell } from "@/components/layout/app-shell";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default function TransformationsPage() {
  const { transformations } = getIngestRuntime();
  const list = transformations.listAll();

  return (
    <AppShell title="Transformations">
      <p className="mb-6 text-black/70 dark:text-white/70">
        Field mappings from canonical AdmissionEvent to destination-specific
        payloads. Same source model; different target shapes for Mock / Salesforce /
        Pega.
      </p>

      <div className="space-y-4">
        {list.map((t) => (
          <article
            key={`${t.code}-${t.version}`}
            className="rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{t.code}</h2>
              <p className="font-mono text-xs text-black/50 dark:text-white/50">
                v{t.version} · {t.mappings.length} mappings
              </p>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-md bg-black/[0.04] p-3 font-mono text-xs dark:bg-white/[0.06]">
              {JSON.stringify(t.mappings, null, 2)}
            </pre>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
