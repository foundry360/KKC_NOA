import { AppShell } from "@/components/layout/app-shell";

export default function LoginPage() {
  return (
    <AppShell title="Sign in">
      <p className="text-black/70 dark:text-white/70">
        Supabase Auth wiring is scaffolded. Configure{" "}
        <code className="font-mono text-sm">NEXT_PUBLIC_SUPABASE_*</code> to
        enable admin sessions. Auth UI arrives with the admin cascade.
      </p>
    </AppShell>
  );
}
