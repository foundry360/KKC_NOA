"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  createPatientAction,
  updatePatientAction,
} from "@/app/meridian/actions";
import type { CoverageInfo, Patient, Sex } from "@/src/meridian/types";

type PayerOption = {
  id: string;
  name: string;
  payerType: CoverageInfo["payerType"];
};

type ProviderOption = { id: string; label: string };

export function PatientRecordForm({
  mode,
  patient,
  payers,
  providers,
}: {
  mode: "create" | "edit";
  patient?: Patient;
  payers: PayerOption[];
  providers: ProviderOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [family, setFamily] = useState(patient?.family ?? "");
  const [given, setGiven] = useState(patient?.given.join(" ") ?? "");
  const [sex, setSex] = useState<Sex>(patient?.sex ?? "unknown");
  const [birthDate, setBirthDate] = useState(patient?.birthDate ?? "");
  const [phone, setPhone] = useState(patient?.phone ?? "");
  const [line, setLine] = useState(patient?.address.line[0] ?? "");
  const [city, setCity] = useState(patient?.address.city ?? "Jacksonville");
  const [state, setState] = useState(patient?.address.state ?? "FL");
  const [postalCode, setPostalCode] = useState(
    patient?.address.postalCode ?? "32204"
  );
  const [payerId, setPayerId] = useState(
    patient?.coverage.payerId ?? payers[0]?.id ?? ""
  );
  const [plan, setPlan] = useState(patient?.coverage.plan ?? "");
  const [memberId, setMemberId] = useState(patient?.coverage.memberId ?? "");
  const [groupNumber, setGroupNumber] = useState(
    patient?.coverage.groupNumber ?? ""
  );
  const [coverageType, setCoverageType] = useState(
    patient?.coverage.coverageType ?? "Primary"
  );
  const [diagnosis, setDiagnosis] = useState(patient?.diagnoses[0] ?? "");
  const [providerId, setProviderId] = useState(
    patient?.attendingProviderId ?? ""
  );
  const [mrn, setMrn] = useState(patient?.mrn ?? "");

  function onPayerChange(id: string) {
    setPayerId(id);
    const p = payers.find((x) => x.id === id);
    if (!p) return;
    if (!plan || mode === "create") {
      setPlan(p.payerType === "MEDICARE" ? "Medicare Part A" : `${p.name} PPO`);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payer = payers.find((p) => p.id === payerId);
    if (!payer) {
      setError("Select a payer.");
      return;
    }
    const givenParts = given.trim().split(/\s+/).filter(Boolean);
    if (!family.trim() || givenParts.length === 0) {
      setError("First and last name are required.");
      return;
    }

    const coverage: CoverageInfo = {
      payerId: payer.id,
      payerName: payer.name,
      payerType: payer.payerType,
      plan: plan.trim(),
      memberId: memberId.trim(),
      groupNumber: groupNumber.trim() || undefined,
      coverageType: coverageType.trim() || "Primary",
    };

    startTransition(async () => {
      if (mode === "create") {
        const result = await createPatientAction({
          family: family.trim(),
          given: givenParts,
          sex,
          birthDate,
          phone: phone.trim() || undefined,
          address: {
            line: [line.trim() || "—"],
            city: city.trim(),
            state: state.trim(),
            postalCode: postalCode.trim(),
          },
          coverage,
          diagnoses: diagnosis.trim() ? [diagnosis.trim()] : [],
          attendingProviderId: providerId || undefined,
          mrn: mrn.trim() || undefined,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/meridian/patients/${result.patientId}`);
        router.refresh();
        return;
      }

      if (!patient) return;
      const result = await updatePatientAction({
        id: patient.id,
        mrn: mrn.trim() || patient.mrn,
        family: family.trim(),
        given: givenParts,
        sex,
        birthDate,
        phone: phone.trim() || undefined,
        address: {
          line: [line.trim() || "—"],
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
        },
        coverage,
        diagnoses: diagnosis.trim()
          ? [diagnosis.trim(), ...patient.diagnoses.slice(1)]
          : patient.diagnoses,
        attendingProviderId: providerId || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/meridian/patients/${patient.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error ? <div className="mh-demo">{error}</div> : null}

      <section className="mh-panel">
        <h2 className="mh-panel-title">Demographics</h2>
        <div className="mh-panel-body grid gap-2 sm:grid-cols-3">
          <Field label="Last name">
            <input
              className="mh-input"
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              required
            />
          </Field>
          <Field label="First / middle">
            <input
              className="mh-input"
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              required
            />
          </Field>
          <Field label="MRN">
            <input
              className="mh-input"
              value={mrn}
              onChange={(e) => setMrn(e.target.value)}
              placeholder={mode === "create" ? "Auto-assigned if blank" : undefined}
              readOnly={mode === "edit"}
            />
          </Field>
          <Field label="Date of birth">
            <input
              type="date"
              className="mh-input"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Sex">
            <select
              className="mh-select"
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex)}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="unknown">Unknown</option>
            </select>
          </Field>
          <Field label="Phone">
            <input
              className="mh-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label="Address">
            <input
              className="mh-input"
              value={line}
              onChange={(e) => setLine(e.target.value)}
            />
          </Field>
          <Field label="City">
            <input
              className="mh-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </Field>
          <Field label="State">
            <input
              className="mh-input"
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
              maxLength={2}
            />
          </Field>
          <Field label="ZIP">
            <input
              className="mh-input"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              required
            />
          </Field>
        </div>
      </section>

      <section className="mh-panel">
        <h2 className="mh-panel-title">Coverage</h2>
        <div className="mh-panel-body grid gap-2 sm:grid-cols-3">
          <Field label="Primary payer">
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
          <Field label="Group number">
            <input
              className="mh-input"
              value={groupNumber}
              onChange={(e) => setGroupNumber(e.target.value)}
            />
          </Field>
          <Field label="Coverage type">
            <select
              className="mh-select"
              value={coverageType}
              onChange={(e) => setCoverageType(e.target.value)}
            >
              <option>Primary</option>
              <option>Secondary</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="mh-panel">
        <h2 className="mh-panel-title">Clinical context</h2>
        <div className="mh-panel-body grid gap-2 sm:grid-cols-2">
          <Field label="Problem / diagnosis">
            <input
              className="mh-input"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Optional until admission"
            />
          </Field>
          <Field label="PCP / attending">
            <select
              className="mh-select"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="mh-btn" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Register Patient"
              : "Save Chart"}
        </button>
        <button
          type="button"
          className="mh-btn mh-btn-secondary"
          disabled={pending}
          onClick={() =>
            router.push(
              patient ? `/meridian/patients/${patient.id}` : "/meridian"
            )
          }
        >
          Cancel
        </button>
      </div>
    </form>
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
