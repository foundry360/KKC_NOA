"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import {
  admitPatientAction,
  submitAdmissionToSalesforceAction,
} from "@/app/meridian/actions";
import type {
  AdmissionType,
  CoverageInfo,
  EncounterClass,
  Patient,
} from "@/src/meridian/types";

type Option = { id: string; name: string; facilityId?: string };

type StepState = "pending" | "active" | "done" | "failed";
type Progress = {
  admit: StepState;
  fhir: StepState;
  salesforce: StepState;
  salesforceLabel?: string;
};

const IDLE_PROGRESS: Progress = {
  admit: "pending",
  fhir: "pending",
  salesforce: "pending",
};

export function AdmitForm({
  patient,
  facilities,
  departments,
  providers,
  payers,
}: {
  patient: Patient;
  facilities: Option[];
  departments: Option[];
  providers: Array<{ id: string; label: string }>;
  payers: Array<{
    id: string;
    name: string;
    payerType: CoverageInfo["payerType"];
  }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const submittingRef = useRef(false);

  const [encounterClass, setEncounterClass] =
    useState<EncounterClass>("INPATIENT");
  const [admissionType, setAdmissionType] =
    useState<AdmissionType>("Emergency");
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(
    departments.find((d) => d.facilityId === facilities[0]?.id)?.id ??
      departments[0]?.id ??
      ""
  );
  const [unit, setUnit] = useState("4 South");
  const [room, setRoom] = useState("402");
  const [bed, setBed] = useState("A");
  const [admittedAt, setAdmittedAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [providerId, setProviderId] = useState(
    patient.attendingProviderId ?? providers[0]?.id ?? ""
  );
  const [diagnosis, setDiagnosis] = useState(
    patient.diagnoses[0] ?? "Pneumonia"
  );
  const [service, setService] = useState("Internal Medicine");
  const [payerId, setPayerId] = useState(patient.coverage.payerId);
  const [plan, setPlan] = useState(patient.coverage.plan);
  const [memberId, setMemberId] = useState(patient.coverage.memberId);
  const [groupNumber, setGroupNumber] = useState(
    patient.coverage.groupNumber ?? ""
  );

  const facilityDepartments = useMemo(
    () => departments.filter((d) => d.facilityId === facilityId),
    [departments, facilityId]
  );

  function onFacilityChange(id: string) {
    setFacilityId(id);
    const first = departments.find((d) => d.facilityId === id);
    if (first) setDepartmentId(first.id);
  }

  function onPayerChange(id: string) {
    setPayerId(id);
    const p = payers.find((x) => x.id === id);
    if (p) {
      if (p.payerType === "MEDICARE") setPlan("Medicare Part A");
      else setPlan(`${p.name} PPO`);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError(null);
    if (!unit.trim() || !room.trim() || !diagnosis.trim() || !memberId.trim()) {
      setError("Unit, room, diagnosis, and member ID are required.");
      return;
    }
    const payer = payers.find((p) => p.id === payerId);
    if (!payer) {
      setError("Select a payer.");
      return;
    }

    const coverage: CoverageInfo = {
      payerId: payer.id,
      payerName: payer.name,
      payerType: payer.payerType,
      plan,
      memberId,
      groupNumber: groupNumber || undefined,
      coverageType: "Primary",
    };

    submittingRef.current = true;
    setProgress({ ...IDLE_PROGRESS, admit: "active", fhir: "active" });
    startTransition(async () => {
      const result = await admitPatientAction({
        patientId: patient.id,
        encounterClass,
        admissionType,
        facilityId,
        departmentId,
        unit: unit.trim(),
        room: room.trim(),
        bed: bed.trim() || undefined,
        admittedAt: new Date(admittedAt).toISOString(),
        attendingProviderId: providerId,
        principalDiagnosis: diagnosis.trim(),
        service,
        coverage,
      });
      if (!result.ok) {
        submittingRef.current = false;
        setProgress(null);
        setError(result.error);
        return;
      }

      setProgress({ admit: "done", fhir: "done", salesforce: "active" });
      const sf = await submitAdmissionToSalesforceAction(result.encounterId);
      const created =
        sf.ok && (sf.outcome === "submitted" || sf.outcome === "already_submitted");
      setProgress({
        admit: "done",
        fhir: "done",
        salesforce: created ? "done" : "failed",
        salesforceLabel: created
          ? "Salesforce Admission Created"
          : "Salesforce Submission Failed",
      });

      router.push(`/meridian/admissions/${result.encounterId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error ? <div className="mh-demo">{error}</div> : null}
      {progress ? <AdmitProgress progress={progress} /> : null}

      <section className="mh-panel">
        <h2 className="mh-panel-title">Patient</h2>
        <div className="mh-panel-body grid gap-2 sm:grid-cols-4 text-[14px]">
          <div>
            <p className="mh-label">Name</p>
            <p className="font-semibold">
              {patient.given.join(" ")} {patient.family}
            </p>
          </div>
          <div>
            <p className="mh-label">MRN</p>
            <p className="font-mono text-[12px]">{patient.mrn}</p>
          </div>
          <div>
            <p className="mh-label">DOB</p>
            <p>{patient.birthDate}</p>
          </div>
          <div>
            <p className="mh-label">Sex</p>
            <p>{patient.sex}</p>
          </div>
        </div>
      </section>

      <section className="mh-panel">
        <h2 className="mh-panel-title">Encounter</h2>
        <div className="mh-panel-body grid gap-2 sm:grid-cols-3">
          <Field label="Encounter Type">
            <select
              className="mh-select"
              value={encounterClass}
              onChange={(e) =>
                setEncounterClass(e.target.value as EncounterClass)
              }
            >
              <option value="INPATIENT">Inpatient</option>
              <option value="OBSERVATION">Observation</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </Field>
          <Field label="Admission Type">
            <select
              className="mh-select"
              value={admissionType}
              onChange={(e) =>
                setAdmissionType(e.target.value as AdmissionType)
              }
            >
              <option>Emergency</option>
              <option>Elective</option>
              <option>Urgent</option>
              <option>Transfer</option>
            </select>
          </Field>
          <Field label="Admission Date/Time">
            <input
              type="datetime-local"
              className="mh-input"
              value={admittedAt}
              onChange={(e) => setAdmittedAt(e.target.value)}
              required
            />
          </Field>
          <Field label="Facility">
            <select
              className="mh-select"
              value={facilityId}
              onChange={(e) => onFacilityChange(e.target.value)}
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select
              className="mh-select"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              {facilityDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unit">
            <input
              className="mh-input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
            />
          </Field>
          <Field label="Room">
            <input
              className="mh-input"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              required
            />
          </Field>
          <Field label="Bed">
            <input
              className="mh-input"
              value={bed}
              onChange={(e) => setBed(e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="mh-panel">
        <h2 className="mh-panel-title">Coverage</h2>
        <div className="mh-panel-body grid gap-2 sm:grid-cols-3">
          <Field label="Primary Payer">
            <select
              className="mh-select"
              value={payerId}
              onChange={(e) => onPayerChange(e.target.value)}
            >
              {payers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plan">
            <input
              className="mh-input"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              required
            />
          </Field>
          <Field label="Member ID">
            <input
              className="mh-input"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              required
            />
          </Field>
          <Field label="Group Number">
            <input
              className="mh-input"
              value={groupNumber}
              onChange={(e) => setGroupNumber(e.target.value)}
            />
          </Field>
          <Field label="Coverage Type">
            <input className="mh-input" value="Primary" readOnly />
          </Field>
        </div>
      </section>

      <section className="mh-panel">
        <h2 className="mh-panel-title">Clinical Information</h2>
        <div className="mh-panel-body grid gap-2 sm:grid-cols-3">
          <Field label="Principal Diagnosis">
            <input
              className="mh-input"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              required
            />
          </Field>
          <Field label="Attending Provider">
            <select
              className="mh-select"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Service">
            <input
              className="mh-input"
              value={service}
              onChange={(e) => setService(e.target.value)}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="mh-btn" disabled={pending || !!progress}>
          {pending || progress ? "Admitting…" : "Admit Patient"}
        </button>
        <button
          type="button"
          className="mh-btn mh-btn-secondary"
          onClick={() => router.push(`/meridian/patients/${patient.id}`)}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function AdmitProgress({ progress }: { progress: Progress }) {
  const steps: Array<{ state: StepState; active: string; done: string; failed?: string }> = [
    { state: progress.admit, active: "Admitting Patient…", done: "Patient Admitted" },
    { state: progress.fhir, active: "Generating FHIR Admission…", done: "FHIR Admission Generated" },
    {
      state: progress.salesforce,
      active: "Sending to Salesforce…",
      done: progress.salesforceLabel ?? "Salesforce Admission Created",
      failed: progress.salesforceLabel ?? "Salesforce Submission Failed",
    },
  ];
  return (
    <section className="mh-panel" aria-live="polite">
      <h2 className="mh-panel-title">Admission Progress</h2>
      <ul className="mh-panel-body space-y-1 text-[14px]">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className={
                s.state === "done"
                  ? "mh-badge mh-badge-ok"
                  : s.state === "failed"
                    ? "mh-badge mh-badge-danger"
                    : "mh-badge"
              }
            >
              {s.state === "done" ? "✓" : s.state === "failed" ? "!" : s.state === "active" ? "…" : "○"}
            </span>
            <span className={s.state === "pending" ? "text-[var(--mh-muted)]" : undefined}>
              {s.state === "done"
                ? s.done
                : s.state === "failed"
                  ? s.failed ?? s.done
                  : s.active}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mh-label">{label}</span>
      {children}
    </label>
  );
}
