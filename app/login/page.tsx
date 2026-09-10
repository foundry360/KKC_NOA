import { AppShell } from "@/components/layout/app-shell";
import { Panel } from "@/components/ui/primitives";

export default function LoginPage() {
  return (
    <AppShell
      title="Sign in"
      description="Admin authentication via Supabase Auth."
    >
      <Panel>
        <p className="text-sm text-muted">
          Auth client scaffolding is in place. Configure{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_*</code> and
          wire the sign-in form when you harden the admin surface.
        </p>
      </Panel>
    </AppShell>
  );
}
