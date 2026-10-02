import type {
  NotificationWindow,
} from "@/src/domain/payer-requirements/types";
import type { NotificationTimingStatus } from "@/src/domain/decisions/decision";

/** Add N business days (Mon–Fri), skipping weekends. Holidays: UNKNOWN / not modeled. */
export function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start.getTime());
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return result;
}

export function computeDeadline(
  window: NotificationWindow,
  start: Date
): Date {
  if (window.unit === "HOURS") {
    return new Date(start.getTime() + window.value * 60 * 60 * 1000);
  }
  if (window.unit === "CALENDAR_DAYS") {
    const d = new Date(start.getTime());
    d.setUTCDate(d.getUTCDate() + window.value);
    return d;
  }
  return addBusinessDays(start, window.value);
}

/**
 * Evaluate notification timing against a configured window.
 * Returns UNKNOWN when the window or start time cannot be verified.
 */
export function evaluateNotificationTiming(
  window: NotificationWindow | "UNKNOWN" | undefined,
  admissionDateTime: string | undefined,
  asOf: Date
): NotificationTimingStatus {
  if (!window || window === "UNKNOWN") return "UNKNOWN";
  if (!admissionDateTime) return "UNKNOWN";
  const start = new Date(admissionDateTime);
  if (Number.isNaN(start.getTime())) return "UNKNOWN";

  const deadline = computeDeadline(window, start);
  return asOf.getTime() <= deadline.getTime() ? "DUE" : "OVERDUE";
}
