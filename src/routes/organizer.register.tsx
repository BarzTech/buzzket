import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Loader2, Ticket } from "lucide-react";

import { useAuth } from "@/lib/auth/context";
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

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error } = await auth.signUpWithEmail(email, password, "organizer");
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    navigate({ to: "/dashboard" });
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
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-center text-xl font-bold">Register as an organiser</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Create an organiser account to publish events and scan tickets.
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

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="organizer-name">Organiser name</Label>
            <Input id="organizer-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="organizer-email">Email</Label>
            <Input id="organizer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="organizer-password">Password</Label>
            <Input id="organizer-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button
            onClick={submit}
            disabled={busy || !name || !email || !password}
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
