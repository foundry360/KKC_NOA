"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/rules", label: "Rules" },
  { href: "/contracts", label: "Contracts" },
  { href: "/transformations", label: "Transforms" },
  { href: "/destinations", label: "Destinations" },
  { href: "/deliveries", label: "Deliveries" },
  { href: "/audit", label: "Audit" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="noa-animate-nav mx-auto flex max-w-6xl gap-0.5 overflow-x-auto px-4 pb-3"
    >
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "whitespace-nowrap border-b-2 border-accent px-3 py-1.5 text-sm font-medium text-foreground"
                : "whitespace-nowrap border-b-2 border-transparent px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
