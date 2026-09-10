import { AppShell } from "@/components/layout/app-shell";
import { Panel } from "@/components/ui/primitives";

export default function PlaceholderPage({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <AppShell title={title}>
      <Panel>
        <p className="text-sm text-muted">{blurb}</p>
      </Panel>
    </AppShell>
  );
}
