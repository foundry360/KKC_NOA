import { AppShell } from "@/components/layout/app-shell";
import { CodeBlock, EmptyState, Panel } from "@/components/ui/primitives";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const { rules } = await getIngestRuntime();
  const versions = await rules.listAll();

  return (
    <AppShell
      title="Rules"
      description="Configurable decisioning. Routing and vendor choice live in contracts."
    >
      {versions.length === 0 ? (
        <EmptyState>No rules seeded.</EmptyState>
      ) : (
        <div className="space-y-4">
          {versions.map((rule) => (
            <Panel key={rule.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-foreground">{rule.name}</h2>
                <p className="font-mono text-xs text-subtle">
                  v{rule.version} · priority {rule.priority}
                </p>
              </div>
              <p className="mt-2 text-sm text-muted">
                Action: {String(rule.actions.decision)}
                {rule.actions.notificationType
                  ? ` · ${String(rule.actions.notificationType)}`
                  : ""}
                {rule.actions.priority
                  ? ` · ${String(rule.actions.priority)}`
                  : ""}
              </p>
              <div className="mt-3">
                <CodeBlock>{JSON.stringify(rule.conditions, null, 2)}</CodeBlock>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </AppShell>
  );
}
