import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";

import { Logo } from "@/components/logo";

import { useAuth } from "@/lib/auth/context";
import { getStoredUser } from "@/lib/auth/session";
import { bootstrapOrganizerProfile } from "@/lib/data/organizers";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/organizer/register")({
  head: () => ({ meta: [{ title: "Organiser Registration - Buzzket" }] }),
  component: OrganizerRegister,
});

function OrganizerRegister() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const { error } = await auth.signUpWithEmail(email, password, "organizer");
      if (error) {
        setError(error);
        return;
      }
      const user = getStoredUser();
      if (!user) {
        setSuccess("Registration successful! Please check your inbox and verify your email to activate your organizer account.");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const accessToken = sessionData.session?.access_token;
      if (accessToken) {
        await bootstrapOrganizerProfile({ data: { accessToken, displayName: name.trim() } });
      }

      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred during registration.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4">
      <Card className="w-full max-w-md p-7">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-bold text-lg">
          <Logo />
        </Link>
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-center text-xl font-bold">Register as an organiser</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Create an organiser account to publish events and scan tickets. New accounts require admin approval before you can list events.
        </p>

        {!auth.supabaseEnabled && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription className="text-xs">
              Supabase is not configured. Organiser registration is disabled until launch environment variables are set.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="default" className="mt-4 border-green-500 bg-green-500/10 text-green-700 dark:text-green-400">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="organizer-name">Organiser name</Label>
            <Input id="organizer-name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy || !!success} />
          </div>
          <div>
            <Label htmlFor="organizer-email">Email</Label>
            <Input id="organizer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy || !!success} />
          </div>
          <div>
            <Label htmlFor="organizer-password">Password</Label>
            <Input id="organizer-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy || !!success} />
          </div>
          <Button
            onClick={submit}
            disabled={busy || !!success || !name || !email || !password}
            className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create organiser account"}
          </Button>
          <Link to="/login" search={{ redirect: "/dashboard" }} className="block text-center text-xs text-muted-foreground hover:text-foreground">
            Already registered? Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
