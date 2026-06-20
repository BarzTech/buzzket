import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, Loader2, Ticket } from "lucide-react";

import { useAuth } from "@/lib/auth/context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

function safeRedirect(value: unknown): string {
  if (typeof value !== "string") return "/admin";
  if (!value.startsWith("/") || value.startsWith("//")) return "/admin";
  if (value.startsWith("/login") || value.startsWith("/admin/login") || value.length > 200) return "/admin";
  return value;
}

export const Route = createFileRoute("/admin/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeRedirect(search.redirect),
  }),
  head: () => ({ meta: [{ title: "Admin Sign in - Buzzket" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error } = await auth.signInWithEmail(email, password);
      if (error) {
        setError(error);
        return;
      }
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
      const role = data.user?.user_metadata?.role;
      if (role !== "admin") {
        await auth.signOut();
        setError("This account is not authorised for the admin console.");
        return;
      }
      navigate({ to: redirect });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin sign-in failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!busy && email && password) {
      void submit();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4">
      <Card className="w-full max-w-md p-7">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-bold text-lg">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Ticket className="h-5 w-5" />
          </span>
          <span className="tracking-tight">buzzket</span>
        </Link>
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-center text-xl font-bold">Admin sign in</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Use an account with the admin role.
        </p>

        {!auth.supabaseEnabled && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription className="text-xs">
              Supabase is not configured. Admin sign-in is disabled until launch environment variables are set.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="admin-email">Admin email</Label>
            <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" disabled={busy} />
          </div>
          <div>
            <Label htmlFor="admin-password">Password</Label>
            <Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={busy} />
          </div>
          <Button
            type="submit"
            disabled={busy || !email || !password}
            className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in to admin"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
