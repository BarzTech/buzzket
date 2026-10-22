import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Smartphone, Loader2 } from "lucide-react";

import { Logo } from "@/components/logo";

import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getStoredUser } from "@/lib/auth/session";

// Only allow internal redirects: must be an absolute path and not a
// protocol-relative ("//evil.com") or scheme URL. Defends against open redirect.
function safeRedirect(value: unknown): string {
  if (typeof value !== "string") return "/browse";
  if (!value.startsWith("/") || value.startsWith("//")) return "/browse";
  if (value.startsWith("/login") || value.startsWith("/admin/login") || value.length > 200) return "/browse";
  return value;
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeRedirect(search.redirect),
  }),
  head: () => ({ meta: [{ title: "Sign in — Buzzket" }] }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const auth = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // phone state
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);


  const roleDestination = () => {
    const role = getStoredUser()?.role;
    if (role === "admin") return "/admin";
    if (role === "organizer") return "/dashboard";
    return redirect === "/dashboard" || redirect === "/admin" ? "/browse" : redirect;
  };
  const done = () => navigate({ to: roleDestination() });

  const run = async (fn: () => Promise<{ error: string | null }>, onSuccess = done) => {
    setBusy(true);
    setError(null);
    try {
      const { error } = await fn();
      if (error) setError(error);
      else onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error } = await auth.signInWithPhone(phone);
      if (error) setError(error);
      else setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code. Check your connection and try again.");
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

        <h1 className="text-center text-xl font-bold">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Verify your phone number to access your Buzzket customer account.
        </p>

        {!auth.supabaseEnabled && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription className="text-xs">
              Supabase is not configured. Add the launch environment variables before sign-in.
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
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+256 7XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={otpSent || busy}
              />
            </div>
            {otpSent && (
              <div>
                <Label htmlFor="otp">Verification code</Label>
                <Input id="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="Verification code" value={otp} onChange={(e) => setOtp(e.target.value)} disabled={busy} />
              </div>
            )}
            {!otpSent ? (
              <Button onClick={sendOtp} disabled={busy || !phone} className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Smartphone className="mr-2 h-4 w-4" /> Send code</>}
              </Button>
            ) : (
              <Button onClick={() => run(() => auth.verifyPhoneOtp(phone, otp))} disabled={busy || !otp} className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
              </Button>
            )}
            <Link to="/admin/login" search={{ redirect: "/admin" }} className="block text-center text-xs text-muted-foreground hover:underline">Staff sign in</Link>
            <Link to="/organizer/register" className="block text-center text-xs font-medium text-primary hover:underline">Apply as an organiser</Link>
        </div>
      </Card>
    </div>
  );
}
