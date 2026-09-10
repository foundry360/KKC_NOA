import type { ReactNode } from "react";
import Link from "next/link";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong bg-surface px-4 py-8 text-center">
      <p className="font-mono text-sm text-muted">{children}</p>
    </div>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricGrid({
  items,
}: {
  items: ReadonlyArray<{ label: string; value: number | string }>;
}) {
  return (
    <dl className="grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="bg-surface-raised px-4 py-4">
          <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-subtle">
            {item.label}
          </dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DefList({
  items,
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    mono?: boolean;
    wide?: boolean;
  }>;
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className={item.wide ? "sm:col-span-2" : undefined}
        >
          <dt className="text-xs uppercase tracking-[0.1em] text-subtle">
            {item.label}
          </dt>
          <dd
            className={
              item.mono
                ? "mt-0.5 break-all font-mono text-xs text-foreground"
                : "mt-0.5 text-foreground"
            }
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border border-line bg-surface px-3 py-3 font-mono text-xs leading-relaxed text-foreground">
      {children}
    </pre>
  );
}

export function StatusBadge({
  value,
  tone = "neutral",
}: {
  value: string;
  tone?: "neutral" | "success" | "danger" | "warn" | "accent";
}) {
  const tones: Record<typeof tone, string> = {
    neutral: "border-line bg-surface text-muted",
    success: "border-success/20 bg-success-soft text-success",
    danger: "border-danger/20 bg-danger-soft text-danger",
    warn: "border-warn/20 bg-warn-soft text-warn",
    accent: "border-accent/20 bg-accent-soft text-accent",
  };
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-xs font-medium tracking-wide ${tones[tone]}`}
    >
      {value}
    </span>
  );
}

export function processingTone(
  state: string
): "neutral" | "success" | "danger" | "warn" | "accent" {
  if (state === "ACKNOWLEDGED" || state === "DELIVERED") return "success";
  if (
    state.includes("FAILED") ||
    state === "DEAD_LETTER" ||
    state === "VALIDATION_FAILED" ||
    state === "RULE_REJECTED"
  ) {
    return "danger";
  }
  if (state === "RETRY_PENDING" || state === "NO_CONTRACT") return "warn";
  if (state === "EVALUATED" || state === "ROUTED" || state === "TRANSFORMED") {
    return "accent";
  }
  return "neutral";
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="border border-line bg-surface-raised px-4 py-4">
      {children}
    </div>
  );
}

export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-accent underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
