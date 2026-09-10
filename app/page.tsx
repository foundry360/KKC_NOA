import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Panel, TextLink } from "@/components/ui/primitives";

export default function HomePage() {
  return (
    <AppShell
      title="Overview"
      description="FHIR admission events orchestrated into payer notifications — vendors stay at the edge."
    >
      <section className="mb-10 max-w-2xl space-y-3">
        <p className="text-lg leading-relaxed text-foreground">
          Validate → normalize → decide → route → transform → deliver →
          acknowledge → audit.
        </p>
        <p className="text-sm text-muted">
          Salesforce and Pega are delivery adapters. The platform core is
          destination-agnostic.
        </p>
      </section>

      <section className="mb-10 grid gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard"
          className="border border-line bg-surface-raised px-4 py-4 transition-colors hover:border-accent/40"
        >
          <p className="font-semibold text-foreground">Dashboard</p>
          <p className="mt-1 text-sm text-muted">
            Live metrics from persisted pipeline records
          </p>
        </Link>
        <Link
          href="/events"
          className="border border-line bg-surface-raised px-4 py-4 transition-colors hover:border-accent/40"
        >
          <p className="font-semibold text-foreground">Events</p>
          <p className="mt-1 text-sm text-muted">
            Full journey from FHIR ingest to acknowledgement
          </p>
        </Link>
        <Link
          href="/meridian"
          className="border border-line bg-surface-raised px-4 py-4 transition-colors hover:border-accent/40 sm:col-span-2"
        >
          <p className="font-semibold text-foreground">Meridian Clinical</p>
          <p className="mt-1 text-sm text-muted">
            Mock EHR source system — admit patient → FHIR → this accelerator
          </p>
        </Link>
      </section>

      <Panel>
        <p className="font-mono text-xs text-muted">
          POC ready · POST /api/fhir/r4/events · Docs in /docs
        </p>
        <p className="mt-2">
          <TextLink href="/dashboard">Open dashboard →</TextLink>
        </p>
      </Panel>
    </AppShell>
  );
}
