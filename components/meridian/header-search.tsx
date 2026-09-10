"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { searchPatientsAction } from "@/app/meridian/actions";

export function HeaderPatientSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<
    Array<{ id: string; mrn: string; name: string }>
  >([]);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        const matches = await searchPatientsAction(q);
        setResults(matches);
        setOpen(true);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  function goCensus() {
    const query = q.trim();
    setOpen(false);
    router.push(query ? `/meridian?q=${encodeURIComponent(query)}` : "/meridian");
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <input
        type="search"
        className="mh-header-search"
        placeholder="Search patients by name or MRN…"
        aria-label="Search patients by name or MRN"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (results.length === 1) {
              setOpen(false);
              router.push(`/meridian/patients/${results[0].id}`);
            } else {
              goCensus();
            }
          }
        }}
      />
      {open && q.trim() ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 border border-[var(--mh-line)] bg-white text-[var(--mh-text)] shadow-md">
          {pending && results.length === 0 ? (
            <p className="px-3 py-2 text-[14px] text-[var(--mh-muted)]">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-[14px] text-[var(--mh-muted)]">
              No matches. Press Enter to search census.
            </p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[14px] hover:bg-[var(--mh-row)]"
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                      router.push(`/meridian/patients/${r.id}`);
                    }}
                  >
                    <span className="font-semibold">{r.name}</span>
                    <span className="font-mono text-[12px] text-[var(--mh-muted)]">
                      {r.mrn}
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="w-full border-t border-[var(--mh-line)] px-3 py-2 text-left text-[14px] text-[var(--mh-accent)] hover:bg-[var(--mh-row)]"
                  onClick={goCensus}
                >
                  View all matches in census →
                </button>
              </li>
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
