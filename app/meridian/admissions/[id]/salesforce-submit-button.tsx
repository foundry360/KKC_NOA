"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { submitAdmissionToSalesforceAction } from "@/app/meridian/actions";

export function SalesforceSubmitButton({
  admissionId,
  label,
}: {
  admissionId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  function onClick() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      const result = await submitAdmissionToSalesforceAction(admissionId);
      inFlight.current = false;
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <button type="button" className="mh-btn" onClick={onClick} disabled={pending}>
        {pending ? "Sending to Salesforce…" : label}
      </button>
      {error ? <p className="text-[14px] text-[var(--mh-danger)]">{error}</p> : null}
    </div>
  );
}
