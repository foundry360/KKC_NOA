import Link from "next/link";
import { notFound } from "next/navigation";
import { MeridianShell } from "@/components/meridian/shell";
import { formatDt } from "@/components/meridian/patient-banner";
import {
  FACILITIES,
  findFhirByEncounter,
  findNotificationByEncounter,
  getEncounter,
  getPatient,
  getSalesforceSubmission,
  isSalesforceSubmissionInFlight,
  serializeAdmissionPayload,
} from "@/src/meridian/store/runtime";
import type { SalesforceIntegrationStatus } from "@/src/meridian/types";
import { SalesforceSubmitButton } from "./salesforce-submit-button";

export const dynamic = "force-dynamic";

const SF_STATUS_LABEL: Record<SalesforceIntegrationStatus, string> = {
  PENDING: "Not Yet Submitted",
  SUBMITTING: "Submitting",
  SUBMITTED: "Submitted",
  FAILED: "Submission Failed",
  RETRYABLE: "Submission Failed (Retryable)",
};

const SF_STATUS_BADGE: Record<SalesforceIntegrationStatus, string> = {
  PENDING: "mh-badge mh-badge-warn",
  SUBMITTING: "mh-badge mh-badge-warn",
  SUBMITTED: "mh-badge mh-badge-ok",
  FAILED: "mh-badge mh-badge-danger",
  RETRYABLE: "mh-badge mh-badge-danger",
};

export default async function AdmissionConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const encounter = getEncounter(id);
  if (!encounter) notFound();
  const patient = getPatient(encounter.patientId);
  if (!patient) notFound();
  const facility = FACILITIES.find((f) => f.id === encounter.facilityId);
  const fhir = findFhirByEncounter(encounter.id);
  const notification = findNotificationByEncounter(encounter.id);
  const salesforce = getSalesforceSubmission(encounter.id);
  const sfInFlight = isSalesforceSubmissionInFlight(encounter.id);
  const payload = fhir ? serializeAdmissionPayload(fhir.bundle) : null;
  const canSubmit =
    !!fhir &&
    !sfInFlight &&
    (!salesforce ||
      salesforce.status === "PENDING" ||
      salesforce.status === "FAILED" ||
      salesforce.status === "RETRYABLE" ||
      salesforce.status === "SUBMITTING");

  return (
    <MeridianShell title="Admission Confirmation">
      <h1 className="mb-3 text-[14px] font-semibold text-[var(--mh-navy)]">
        Patient Successfully Admitted
      </h1>

      {notification?.demoMode ? (
        <div className="mh-demo mb-3">
          Demo Mode — NOA Accelerator response was simulated
          {notification.timeline[0] ? "" : ""}. Integration path still ends at
          FHIR → NOA; results are labeled.
        </div>
      ) : null}

      <section className="mh-panel mb-3">
        <h2 className="mh-panel-title">Admission</h2>
        <div className="mh-panel-body space-y-1 text-[14px]">
          <p className="text-[14px] font-semibold">
            {patient.given.join(" ")} {patient.family}
          </p>
          <p className="font-mono text-[12px]">{patient.mrn}</p>
          <p className="mt-2 font-semibold">
            {encounter.encounterClass} Admission
          </p>
          <p>{facility?.name}</p>
          <p>
            {encounter.unit} / Room {encounter.room}
          </p>
          <p>Admission: {formatDt(encounter.admittedAt)}</p>
          <p>
            Primary Payer: {encounter.coverageSnapshot.payerName}
            {encounter.coverageSnapshot.plan
              ? ` — ${encounter.coverageSnapshot.plan}`
              : ""}
          </p>
          <p>Diagnosis: {encounter.principalDiagnosis}</p>
        </div>
      </section>

      <section className="mh-panel mb-3">
        <h2 className="mh-panel-title">Integration Status</h2>
        <div className="mh-panel-body grid gap-3 text-[14px] sm:grid-cols-3">
          <div>
            <p className="mh-label">Admission</p>
            <p>
              Status:{" "}
              <span className="mh-badge mh-badge-ok">{encounter.status}</span>
            </p>
          </div>
          <div>
            <p className="mh-label">FHIR</p>
            <p>
              Status:{" "}
              <span className={fhir ? "mh-badge mh-badge-ok" : "mh-badge mh-badge-warn"}>
                {fhir ? "Generated" : "Not Generated"}
              </span>
            </p>
            {fhir ? (
              <p className="text-[var(--mh-muted)]">R4 {String(fhir.bundle.type ?? "")} Bundle</p>
            ) : null}
          </div>
          <div>
            <p className="mh-label">Salesforce</p>
            <p>
              Status:{" "}
              <span className={SF_STATUS_BADGE[salesforce?.status ?? "PENDING"]}>
                {sfInFlight ? "Submitting" : SF_STATUS_LABEL[salesforce?.status ?? "PENDING"]}
              </span>
            </p>
            {salesforce?.salesforceRecordId ? (
              <p>
                Record ID:{" "}
                <span className="font-mono text-[12px]">{salesforce.salesforceRecordId}</span>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mh-panel mb-3">
        <h2 className="mh-panel-title">Salesforce Submission</h2>
        <div className="mh-panel-body space-y-2 text-[14px]">
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <p className="mh-label">Object</p>
              <p className="font-mono text-[12px]">Admission__c.Payload__c</p>
            </div>
            <div>
              <p className="mh-label">Record ID</p>
              {salesforce?.salesforceRecordId ? (
                salesforce.salesforceRecordUrl ? (
                  <a
                    href={salesforce.salesforceRecordUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[12px] underline"
                  >
                    {salesforce.salesforceRecordId}
                  </a>
                ) : (
                  <p className="font-mono text-[12px]">{salesforce.salesforceRecordId}</p>
                )
              ) : (
                <p>—</p>
              )}
            </div>
            <div>
              <p className="mh-label">Submitted</p>
              <p>{salesforce?.submittedAt ? formatDt(salesforce.submittedAt) : "—"}</p>
            </div>
            <div>
              <p className="mh-label">Attempts</p>
              <p>{salesforce?.attemptCount ?? 0}</p>
            </div>
            <div>
              <p className="mh-label">Last Attempt</p>
              <p>{salesforce?.lastAttemptAt ? formatDt(salesforce.lastAttemptAt) : "—"}</p>
            </div>
            <div>
              <p className="mh-label">Payload Size</p>
              <p>{payload ? `${payload.length.toLocaleString()} / 130,768 chars` : "—"}</p>
            </div>
          </div>

          {salesforce?.errorMessage && salesforce.status !== "SUBMITTED" ? (
            <div className="mh-demo">
              {salesforce.errorType ? `${salesforce.errorType}: ` : ""}
              {salesforce.errorMessage}
            </div>
          ) : null}

          {canSubmit ? (
            <SalesforceSubmitButton
              admissionId={encounter.id}
              label={
                !salesforce || salesforce.status === "PENDING"
                  ? "Submit to Salesforce"
                  : salesforce.status === "SUBMITTING"
                    ? "Check Salesforce Submission"
                    : "Retry Salesforce Submission"
              }
            />
          ) : null}

          {payload ? (
            <details>
              <summary className="cursor-pointer font-semibold">
                View Payload__c (FHIR R4 JSON sent to Salesforce)
              </summary>
              <pre className="mt-2 max-h-[420px] overflow-auto border border-[var(--mh-line)] bg-[var(--mh-row)] p-2 font-mono text-[12px]">
                {payload}
              </pre>
            </details>
          ) : null}
        </div>
      </section>

      <section className="mh-panel mb-3">
        <h2 className="mh-panel-title">Notification</h2>
        <div className="mh-panel-body space-y-2 text-[14px]">
          <p className="font-semibold">Admission notification initiated</p>
          <ul className="space-y-1">
            <li>
              FHIR Event{" "}
              <span className="mh-badge mh-badge-ok">
                {fhir?.status === "SENT" ? "Created + Sent" : fhir?.status ?? "—"}
              </span>
            </li>
            <li>
              NOA Processing{" "}
              <span
                className={
                  notification?.processingState === "ACKNOWLEDGED"
                    ? "mh-badge mh-badge-ok"
                    : "mh-badge mh-badge-warn"
                }
              >
                {notification?.processingState ?? "In Progress"}
              </span>
            </li>
          </ul>
          {notification ? (
            <p className="font-mono text-[14px] text-[var(--mh-muted)]">
              Correlation: {notification.correlationId}
            </p>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {fhir ? (
          <Link href={`/meridian/fhir-events/${fhir.id}`} className="mh-btn">
            View FHIR Event
          </Link>
        ) : null}
        {notification ? (
          <Link
            href={`/meridian/notifications/${notification.id}`}
            className="mh-btn mh-btn-secondary"
          >
            View Notification
          </Link>
        ) : null}
        <Link
          href={`/meridian/patients/${patient.id}`}
          className="mh-btn mh-btn-secondary"
        >
          Return to chart
        </Link>
      </div>
    </MeridianShell>
  );
}
