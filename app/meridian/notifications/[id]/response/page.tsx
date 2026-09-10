import Link from "next/link";
import { notFound } from "next/navigation";
import { MeridianShell } from "@/components/meridian/shell";
import { formatDt } from "@/components/meridian/patient-banner";
import {
  getEncounter,
  getNotification,
} from "@/src/meridian/store/runtime";

export const dynamic = "force-dynamic";

export default async function PayerResponsePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const notification = getNotification(id);
  if (!notification) notFound();
  const encounter = getEncounter(notification.encounterId);
  const accepted =
    notification.processingState === "ACKNOWLEDGED" ||
    Boolean(notification.acknowledgement?.ackId);

  return (
    <MeridianShell title="NOA Response">
      <h1 className="mb-3 text-[14px] font-semibold text-[var(--mh-navy)]">
        NOA Response
      </h1>

      {notification.demoMode ? (
        <div className="mh-demo mb-3">Demo Mode — acknowledgement may be simulated</div>
      ) : null}

      <section className="mh-panel mb-3">
        <h2 className="mh-panel-title">Payer acknowledgement summary</h2>
        <div className="mh-panel-body grid gap-2 sm:grid-cols-2 text-[14px]">
          <Field
            label="Status"
            value={accepted ? "ACCEPTED" : notification.processingState ?? "UNKNOWN"}
          />
          <Field
            label="Payer"
            value={encounter?.coverageSnapshot.payerName ?? "—"}
          />
          <Field
            label="Payer Reference"
            value={notification.acknowledgement?.ackId ?? "—"}
            mono
          />
          <Field
            label="Received"
            value={
              notification.acknowledgement?.acknowledgedAt
                ? formatDt(notification.acknowledgement.acknowledgedAt)
                : "—"
            }
          />
          <Field
            label="Message"
            value={
              accepted
                ? "Notification accepted"
                : "Awaiting or incomplete acknowledgement"
            }
          />
          <Field
            label="Adapter"
            value={notification.adapterKey ?? "—"}
          />
        </div>
      </section>

      <Link href={`/meridian/notifications/${id}`} className="mh-btn">
        View Notification Details
      </Link>
    </MeridianShell>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[14px] font-semibold uppercase tracking-[0.05em] text-[var(--mh-subtle)]">
        {label}
      </p>
      <p className={mono ? "font-mono text-[12px]" : "font-semibold"}>{value}</p>
    </div>
  );
}
