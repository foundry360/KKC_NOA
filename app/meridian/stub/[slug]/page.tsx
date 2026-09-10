import Link from "next/link";
import { MeridianShell } from "@/components/meridian/shell";

export default async function MeridianStubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <MeridianShell title={title}>
      <div className="mh-panel">
        <h1 className="mh-panel-title">{title}</h1>
        <div className="mh-panel-body text-[14px] text-[var(--mh-muted)]">
          <p>Not implemented in POC.</p>
          <p className="mt-2">
            Use Patient Census → Patient Chart → Admit Patient for the
            demonstration journey.
          </p>
          <Link href="/meridian" className="mh-btn mt-3 inline-flex">
            Return to census
          </Link>
        </div>
      </div>
    </MeridianShell>
  );
}
