import type { ReactNode } from "react";
import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/rules", label: "Rules" },
  { href: "/contracts", label: "Contracts" },
  { href: "/transformations", label: "Transformations" },
  { href: "/destinations", label: "Destinations" },
  { href: "/deliveries", label: "Deliveries" },
  { href: "/audit", label: "Audit" },
] as const;

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-black/10 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-black/50 dark:text-white/50">
              FHIR NOA Accelerator
            </p>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          </div>
          <p className="text-sm text-black/60 dark:text-white/60">
            Integration &amp; orchestration POC
          </p>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-black/70 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
