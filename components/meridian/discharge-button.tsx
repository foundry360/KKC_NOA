"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { dischargeEncounterAction } from "@/app/meridian/actions";

export function DischargeButton({ encounterId }: { encounterId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="mh-btn mh-btn-secondary"
      disabled={pending}
      onClick={() => {
        if (!confirm("Discharge this encounter from the active census?")) return;
        startTransition(async () => {
          const result = await dischargeEncounterAction(encounterId);
          if (!result.ok) {
            alert(result.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? "Discharging…" : "Discharge"}
    </button>
  );
}
