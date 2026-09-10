"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { HeaderPatientSearch } from "@/components/meridian/header-search";

const NAV = [
  {
    group: "Home",
    items: [{ href: "/meridian", label: "Patient Census", exact: true }],
  },
  {
    group: "Patient Lists",
    items: [
      { href: "/meridian", label: "Patients", exact: true },
      { href: "/meridian/encounters", label: "Encounters" },
    ],
  },
  {
    group: "Clinical",
    items: [
      { href: "/meridian/stub/overview", label: "Overview" },
      { href: "/meridian/stub/diagnoses", label: "Diagnoses" },
      { href: "/meridian/stub/medications", label: "Medications" },
      { href: "/meridian/stub/orders", label: "Orders" },
      { href: "/meridian/stub/results", label: "Results" },
      { href: "/meridian/stub/notes", label: "Notes" },
    ],
  },
  {
    group: "Administrative",
    items: [
      { href: "/meridian/patients/new", label: "Registration" },
      { href: "/meridian/stub/coverage", label: "Coverage" },
      { href: "/meridian/encounters", label: "Admissions" },
    ],
  },
  {
    group: "Interoperability",
    items: [
      { href: "/meridian/stub/fhir-events", label: "FHIR Events" },
      { href: "/meridian/stub/notifications", label: "Notifications" },
    ],
  },
] as const;

export function MeridianShell({
  children,
  banner,
}: {
  title?: string;
  children: ReactNode;
  banner?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="meridian-root flex min-h-screen flex-col">
      <header className="border-b border-[var(--mh-line)] bg-[var(--mh-navy)] text-white">
        <div className="flex items-center justify-between gap-4 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold tracking-tight">
              Meridian Health Partners
            </p>
          </div>
          <div className="hidden flex-1 items-center justify-center md:flex">
            <HeaderPatientSearch />
          </div>
          <div className="flex items-center gap-3 text-[14px] text-white/85">
            <span>Notifications</span>
            <span className="font-semibold">Williams, S. MD</span>
            <Link href="/" className="text-white/70 hover:text-white">
              NOA Admin
            </Link>
          </div>
        </div>
      </header>

      {banner}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-52 shrink-0 border-r border-[var(--mh-line)] bg-[var(--mh-surface)] md:block">
          <nav className="p-2">
            {NAV.map((section) => (
              <div key={section.group} className="mb-3">
                <p className="px-2 pb-1 text-[14px] font-bold uppercase tracking-[0.08em] text-[var(--mh-subtle)]">
                  {section.group}
                </p>
                <ul>
                  {section.items.map((item) => {
                    const exact = "exact" in item && item.exact;
                    const active = exact
                      ? pathname === item.href
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={`${section.group}-${item.label}`}>
                        <Link
                          href={item.href}
                          className={
                            active
                              ? "block border-l-2 border-[var(--mh-accent)] bg-[var(--mh-row)] px-2 py-2 text-[14px] font-semibold text-[var(--mh-navy)]"
                              : "block border-l-2 border-transparent px-2 py-2 text-[14px] text-[var(--mh-muted)] hover:bg-[var(--mh-row)] hover:text-[var(--mh-text)]"
                          }
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-3">{children}</main>
      </div>
    </div>
  );
}
