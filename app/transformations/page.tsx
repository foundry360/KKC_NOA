import { AppShell } from "@/components/layout/app-shell";
import { CodeBlock, EmptyState, Panel } from "@/components/ui/primitives";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default async function TransformationsPage() {
  const { transformations } = await getIngestRuntime();
  const list = await transformations.listAll();

  return (
    <AppShell
      title="Transformations"
      description="Field mappings from AdmissionEvent to destination payloads."
    >
      {list.length === 0 ? (
        <EmptyState>No transformations seeded.</EmptyState>
      ) : (
        <div className="space-y-4">
          {list.map((def) => (
            <Panel key={def.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-foreground">{def.code}</h2>
                <p className="font-mono text-xs text-subtle">
                  v{def.version} · {def.targetFormat}
                </p>
              </div>
              <p className="mt-1 text-sm text-muted">
                Source: {def.sourceModel}
              </p>
              <div className="mt-3">
                <CodeBlock>{JSON.stringify(def.mappings, null, 2)}</CodeBlock>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </AppShell>
  );
}
