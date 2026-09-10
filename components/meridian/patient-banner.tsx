import type { Encounter, Patient } from "@/src/meridian/types";
import { FACILITIES, PROVIDERS } from "@/src/meridian/data/seed";

export function PatientBanner({
  patient,
  encounter,
}: {
  patient: Patient;
  encounter?: Encounter | null;
}) {
  const facility = encounter
    ? FACILITIES.find((f) => f.id === encounter.facilityId)
    : undefined;
  const provider = encounter
    ? PROVIDERS.find((p) => p.id === encounter.attendingProviderId)
    : PROVIDERS.find((p) => p.id === patient.attendingProviderId);

  return (
    <div className="border-b border-[var(--mh-line)] bg-[var(--mh-banner)] px-3 py-2 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold">
            {patient.given.join(" ")} {patient.family}
          </p>
          <p className="text-[14px] text-white/80">
            <span className="font-mono text-[12px]">{patient.mrn}</span> | DOB{" "}
            {formatDob(patient.birthDate)} | {capitalize(patient.sex)}
          </p>
        </div>
        <div className="text-right text-[14px] text-white/85">
          {encounter ? (
            <>
              <p className="font-semibold">{facility?.name}</p>
              <p>
                {encounter.unit} / Room {encounter.room}
              </p>
              <p>
                {titleCase(encounter.encounterClass)} · {encounter.status}
              </p>
              <p>
                Admitted{" "}
                <span className="font-mono text-[12px]">
                  {formatDt(encounter.admittedAt)}
                </span>
              </p>
            </>
          ) : (
            <p className="font-semibold">No active encounter</p>
          )}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-4 text-[14px] text-white/80">
        <span>
          Primary Payer:{" "}
          <strong className="text-white">
            {encounter?.coverageSnapshot.payerName ?? patient.coverage.payerName}
            {encounter?.coverageSnapshot.plan
              ? ` — ${encounter.coverageSnapshot.plan}`
              : patient.coverage.plan
                ? ` — ${patient.coverage.plan}`
                : ""}
          </strong>
        </span>
        {provider ? (
          <span>
            Attending:{" "}
            <strong className="text-white">
              {provider.name}, {provider.credentials}
            </strong>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function formatDob(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

export function formatDt(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
