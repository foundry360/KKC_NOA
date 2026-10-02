import Link from "next/link";
import { notFound } from "next/navigation";
import { MeridianShell } from "@/components/meridian/shell";
import { DischargeButton } from "@/components/meridian/discharge-button";
import {
  PatientBanner,
  formatDob,
  formatDt,
} from "@/components/meridian/patient-banner";
import {
  DEPARTMENTS,
  FACILITIES,
  PROVIDERS,
  getActiveEncounter,
  getPatient,
  listEncountersForPatient,
  listFhirEventsForPatient,
  listNotificationsForPatient,
} from "@/src/meridian/store/runtime";

export const dynamic = "force-dynamic";

const TABS = [
  "Overview",
  "Encounters",
  "Diagnoses",
  "Coverage",
  "Providers",
  "FHIR Events",
  "Notifications",
] as const;

export default async function PatientChartPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const patient = await getPatient(id);
  if (!patient) notFound();
  const [encounter, history, fhirEvents, notifications] = await Promise.all([
    getActiveEncounter(id),
    listEncountersForPatient(id),
    listFhirEventsForPatient(id),
    listNotificationsForPatient(id),
  ]);
  const notificationByEncounter = new Map(
    [...notifications].reverse().map((n) => [n.encounterId, n])
  );
  const facility = encounter
    ? FACILITIES.find((f) => f.id === encounter.facilityId)
    : undefined;
  const department = encounter
    ? DEPARTMENTS.find((d) => d.id === encounter.departmentId)
    : undefined;
  const provider = PROVIDERS.find(
    (p) =>
      p.id ===
      (encounter?.attendingProviderId ?? patient.attendingProviderId)
  );
  const notification = encounter
    ? notificationByEncounter.get(encounter.id) ?? null
    : null;
  const activeTab = (TABS.includes(tab as (typeof TABS)[number])
    ? tab
    : "Overview") as (typeof TABS)[number];

  return (
    <MeridianShell
      title={`Chart · ${patient.family}`}
      banner={<PatientBanner patient={patient} encounter={encounter} />}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 border-b border-[var(--mh-line)]">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/meridian/patients/${id}?tab=${encodeURIComponent(t)}`}
              className={
                activeTab === t
                  ? "border-b-2 border-[var(--mh-accent)] px-3 py-1.5 text-[14px] font-semibold text-[var(--mh-navy)]"
                  : "px-3 py-1.5 text-[14px] text-[var(--mh-muted)] hover:text-[var(--mh-text)]"
              }
            >
              {t}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/meridian/patients/${id}/edit`}
            className="mh-btn mh-btn-secondary"
          >
            Edit Record
          </Link>
          {encounter ? (
            <DischargeButton encounterId={encounter.id} />
          ) : null}
          <Link href={`/meridian/patients/${id}/admit`} className="mh-btn">
            Admit Patient
          </Link>
        </div>
      </div>

      {activeTab === "Overview" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="mh-panel">
            <h2 className="mh-panel-title">Patient Demographics</h2>
            <div className="mh-panel-body grid grid-cols-2 gap-2 text-[14px]">
              <Field
                label="Name"
                value={`${patient.given.join(" ")} ${patient.family}`}
              />
              <Field label="MRN" value={patient.mrn} mono />
              <Field label="DOB" value={formatDob(patient.birthDate)} />
              <Field label="Sex" value={patient.sex} />
              <Field
                label="Address"
                value={`${patient.address.line[0]}, ${patient.address.city}, ${patient.address.state} ${patient.address.postalCode}`}
              />
              <Field label="Phone" value={patient.phone ?? "—"} />
            </div>
          </section>

          <section className="mh-panel">
            <h2 className="mh-panel-title">Current Encounter</h2>
            <div className="mh-panel-body grid grid-cols-2 gap-2 text-[14px]">
              {encounter ? (
                <>
                  <Field
                    label="Encounter type"
                    value={encounter.encounterClass}
                  />
                  <Field
                    label="Admission type"
                    value={encounter.admissionType}
                  />
                  <Field
                    label="Date/time"
                    value={formatDt(encounter.admittedAt)}
                    mono
                  />
                  <Field label="Facility" value={facility?.name ?? "—"} />
                  <Field label="Department" value={department?.name ?? "—"} />
                  <Field
                    label="Location"
                    value={`${encounter.unit} / ${encounter.room}${encounter.bed ? ` / ${encounter.bed}` : ""}`}
                  />
                  <Field
                    label="Attending"
                    value={
                      provider
                        ? `${provider.name}, ${provider.credentials}`
                        : "—"
                    }
                  />
                </>
              ) : (
                <p className="col-span-2 text-[var(--mh-muted)]">
                  No active encounter. Use Admit Patient to create one.
                </p>
              )}
            </div>
          </section>

          <section className="mh-panel">
            <h2 className="mh-panel-title">Coverage</h2>
            <div className="mh-panel-body grid grid-cols-2 gap-2 text-[14px]">
              <Field
                label="Payer"
                value={
                  encounter?.coverageSnapshot.payerName ??
                  patient.coverage.payerName
                }
              />
              <Field
                label="Plan"
                value={
                  encounter?.coverageSnapshot.plan ?? patient.coverage.plan
                }
              />
              <Field
                label="Member ID"
                value={
                  encounter?.coverageSnapshot.memberId ??
                  patient.coverage.memberId
                }
                mono
              />
              <Field
                label="Coverage type"
                value={
                  encounter?.coverageSnapshot.coverageType ??
                  patient.coverage.coverageType
                }
              />
            </div>
          </section>

          <section className="mh-panel">
            <h2 className="mh-panel-title">Clinical</h2>
            <div className="mh-panel-body grid grid-cols-2 gap-2 text-[14px]">
              <Field
                label="Primary diagnosis"
                value={
                  encounter?.principalDiagnosis ??
                  patient.diagnoses[0] ??
                  "—"
                }
              />
              <Field
                label="Attending provider"
                value={
                  provider
                    ? `${provider.name}, ${provider.credentials}`
                    : "—"
                }
              />
              {notification ? (
                <div className="col-span-2">
                  <Field
                    label="NOA notification"
                    value={notification.processingState ?? "Initiated"}
                  />
                  <Link
                    href={`/meridian/notifications/${notification.id}`}
                    className="mt-1 inline-block text-[14px]"
                  >
                    View notification status
                  </Link>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : activeTab === "Encounters" ? (
        <section className="mh-panel overflow-x-auto">
          <h2 className="mh-panel-title">Encounter history</h2>
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Status</th>
                <th>Location</th>
                <th>Diagnosis</th>
                <th>Admitted</th>
                <th>Notification</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-[var(--mh-muted)]">
                    No encounters for this patient yet.
                  </td>
                </tr>
              ) : (
                history.map((enc) => {
                  const note = notificationByEncounter.get(enc.id);
                  return (
                    <tr key={enc.id}>
                      <td>{enc.encounterClass}</td>
                      <td>
                        <span
                          className={
                            enc.status === "Admitted" || enc.status === "Active"
                              ? "mh-badge mh-badge-ok"
                              : "mh-badge"
                          }
                        >
                          {enc.status}
                        </span>
                      </td>
                      <td>
                        {enc.unit} / {enc.room}
                      </td>
                      <td>{enc.principalDiagnosis}</td>
                      <td className="font-mono text-[12px]">
                        {formatDt(enc.admittedAt)}
                      </td>
                      <td>
                        {note ? (
                          <Link href={`/meridian/notifications/${note.id}`}>
                            {note.processingState ?? "View"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      ) : activeTab === "Coverage" ? (
        <section className="mh-panel">
          <h2 className="mh-panel-title">Coverage</h2>
          <div className="mh-panel-body grid grid-cols-2 gap-2 text-[14px]">
            <Field label="Payer" value={patient.coverage.payerName} />
            <Field label="Plan" value={patient.coverage.plan} />
            <Field label="Member ID" value={patient.coverage.memberId} mono />
            <Field label="Group" value={patient.coverage.groupNumber ?? "—"} />
            <Field label="Type" value={patient.coverage.coverageType} />
            <Field label="Payer type" value={patient.coverage.payerType} />
            <div className="col-span-2">
              <Link
                href={`/meridian/patients/${id}/edit`}
                className="text-[14px]"
              >
                Edit coverage on chart →
              </Link>
            </div>
          </div>
        </section>
      ) : activeTab === "Diagnoses" ? (
        <section className="mh-panel">
          <h2 className="mh-panel-title">Problem list</h2>
          <div className="mh-panel-body text-[14px]">
            {patient.diagnoses.length === 0 ? (
              <p className="text-[var(--mh-muted)]">
                No problems documented. Add via Edit Record or on admission.
              </p>
            ) : (
              <ul className="list-disc pl-4">
                {patient.diagnoses.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : activeTab === "Providers" ? (
        <section className="mh-panel">
          <h2 className="mh-panel-title">Care team</h2>
          <div className="mh-panel-body text-[14px]">
            <Field
              label="Attending / PCP"
              value={
                provider
                  ? `${provider.name}, ${provider.credentials}`
                  : "Unassigned"
              }
            />
            <Link
              href={`/meridian/patients/${id}/edit`}
              className="mt-2 inline-block text-[14px]"
            >
              Change provider →
            </Link>
          </div>
        </section>
      ) : activeTab === "FHIR Events" ? (
        <section className="mh-panel overflow-x-auto">
          <h2 className="mh-panel-title">FHIR events</h2>
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Type</th>
                <th>Status</th>
                <th>Correlation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {fhirEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-[var(--mh-muted)]">
                    No FHIR events yet. Admit the patient to generate an
                    admission Bundle.
                  </td>
                </tr>
              ) : (
                fhirEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="font-mono text-[12px]">
                      {formatDt(event.createdAt)}
                    </td>
                    <td>{event.eventType}</td>
                    <td>
                      <span
                        className={
                          event.status === "SENT"
                            ? "mh-badge mh-badge-ok"
                            : event.status === "FAILED"
                              ? "mh-badge mh-badge-danger"
                              : "mh-badge"
                        }
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="font-mono text-[12px]">
                      {event.correlationId ?? "—"}
                    </td>
                    <td>
                      <Link href={`/meridian/fhir-events/${event.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : activeTab === "Notifications" ? (
        <section className="mh-panel overflow-x-auto">
          <h2 className="mh-panel-title">Notifications</h2>
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>State</th>
                <th>Decision</th>
                <th>Adapter</th>
                <th>Ack</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-[var(--mh-muted)]">
                    No notifications yet. Admit the patient to send a NOA.
                  </td>
                </tr>
              ) : (
                notifications.map((note) => (
                  <tr key={note.id}>
                    <td className="font-mono text-[12px]">
                      {formatDt(note.createdAt)}
                    </td>
                    <td>
                      <span
                        className={
                          note.processingState === "ACKNOWLEDGED"
                            ? "mh-badge mh-badge-ok"
                            : "mh-badge"
                        }
                      >
                        {note.processingState ?? "—"}
                      </span>
                    </td>
                    <td>{note.decision ?? "—"}</td>
                    <td>{note.adapterKey ?? "—"}</td>
                    <td className="font-mono text-[12px]">
                      {note.acknowledgement?.ackId ?? "—"}
                    </td>
                    <td>
                      <Link href={`/meridian/notifications/${note.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : (
        <div className="mh-panel">
          <h2 className="mh-panel-title">{activeTab}</h2>
          <div className="mh-panel-body text-[14px] text-[var(--mh-muted)]">
            Not implemented in POC. Use Registration, Edit Record, Admit, and
            Discharge for the EMR journey.
          </div>
        </div>
      )}
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
      <p className={mono ? "font-mono text-[12px]" : undefined}>{value}</p>
    </div>
  );
}
