import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Buzzket" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters for your new password.");
    if (password !== confirm) return setError("The passwords do not match.");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError("Password reset is temporarily unavailable.");
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("This reset link is invalid or has expired. Request a new one from the sign-in page.");
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      navigate({ to: "/login", search: { redirect: "/browse" } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4"><Card className="w-full max-w-md p-7">
    <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-bold text-lg"><Logo /></Link>
    <h1 className="text-center text-xl font-bold">Choose a new password</h1>
    <p className="mt-1 text-center text-sm text-muted-foreground">Set a new password for your Buzzket account.</p>
    {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="mt-5 space-y-4">
      <div><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} /></div>
      <div><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} /></div>
      <Button onClick={submit} disabled={busy || !password || !confirm} className="w-full bg-cta text-cta-foreground hover:bg-cta/90">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}</Button>
    </div>
  </Card></div>;
}
