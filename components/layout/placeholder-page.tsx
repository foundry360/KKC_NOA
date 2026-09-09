import { AppShell } from "@/components/layout/app-shell";

export default function PlaceholderPage({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <AppShell title={title}>
      <p className="text-black/70 dark:text-white/70">{blurb}</p>
      <p className="mt-4 font-mono text-xs text-black/45 dark:text-white/45">
        Placeholder — implemented in the UI cascade step after the pipeline works.
      </p>
    </AppShell>
  );
}
