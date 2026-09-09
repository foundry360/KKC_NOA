import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";

export default function HomePage() {
  return (
    <AppShell title="Overview">
      <div className="space-y-6">
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            Healthcare event orchestration
          </h2>
          <p className="max-w-2xl text-black/70 dark:text-white/70">
            FHIR in → validation → canonical AdmissionEvent → rules → decision →
            routing → contract → transform → delivery → acknowledgement → audit.
            Salesforce and Pega are delivery adapters, not the platform core.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/dashboard"
            className="rounded-lg border border-black/10 px-4 py-3 hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.04]"
          >
            <p className="font-medium">Dashboard</p>
            <p className="text-sm text-black/60 dark:text-white/60">
              Metrics from persisted events (wired in later steps)
            </p>
          </Link>
          <Link
            href="/events"
            className="rounded-lg border border-black/10 px-4 py-3 hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.04]"
          >
            <p className="font-medium">Events</p>
            <p className="text-sm text-black/60 dark:text-white/60">
              Traceability and Event Detail journey
            </p>
          </Link>
        </section>

        <p className="font-mono text-xs text-black/50 dark:text-white/50">
          Foundation complete · FHIR ingest next · See /docs
        </p>
      </div>
    </AppShell>
  );
}
