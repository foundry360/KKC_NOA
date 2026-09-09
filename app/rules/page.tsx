import { AppShell } from "@/components/layout/app-shell";
import { getIngestRuntime } from "@/src/infrastructure/composition/ingest";

export const dynamic = "force-dynamic";

export default function RulesPage() {
  const { rules } = getIngestRuntime();
  const versions = rules.listAll();

  return (
    <AppShell title="Rules">
      <p className="mb-6 text-black/70 dark:text-white/70">
        Configurable decision rules. Destinations are not encoded here — routing
        and contracts handle Salesforce vs Pega later.
      </p>

      <div className="space-y-4">
        {versions.map((rule) => (
          <article
            key={rule.id}
            className="rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{rule.name}</h2>
              <p className="font-mono text-xs text-black/50 dark:text-white/50">
                v{rule.version} · priority {rule.priority}
              </p>
            </div>
            <p className="mt-2 text-sm text-black/70 dark:text-white/70">
              Action: {String(rule.actions.decision)}
              {rule.actions.notificationType
                ? ` · ${String(rule.actions.notificationType)}`
                : ""}
              {rule.actions.priority ? ` · ${String(rule.actions.priority)}` : ""}
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md bg-black/[0.04] p-3 font-mono text-xs dark:bg-white/[0.06]">
              {JSON.stringify(rule.conditions, null, 2)}
            </pre>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
