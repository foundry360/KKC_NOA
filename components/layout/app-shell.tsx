import type { ReactNode } from "react";
import Link from "next/link";
import { AppNav } from "@/components/layout/app-nav";

export function AppShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen text-foreground">
      <header className="border-b border-line bg-surface-raised/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <Link
              href="/"
              className="inline-block text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent"
            >
              FHIR NOA Accelerator
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-sm text-muted">{description}</p>
            ) : null}
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">
            Integration orchestration
          </p>
        </div>
        <AppNav />
      </header>
      <main className="noa-animate-main mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
