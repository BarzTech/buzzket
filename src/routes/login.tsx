import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Smartphone, Mail, Loader2 } from "lucide-react";

import { Logo } from "@/components/logo";

import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  // email state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const roleDestination = () => {
    const role = getStoredUser()?.role;
    if (role === "admin") return "/admin";
    if (role === "organizer") return "/dashboard";
    return redirect === "/dashboard" || redirect === "/admin" ? "/browse" : redirect;
  };
  const done = () => navigate({ to: roleDestination() });
  const doneAfterBuyerSignup = () => navigate({ to: redirect === "/dashboard" ? "/browse" : redirect });

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
          Sign in to buy tickets, manage events and scan attendees.
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

        <Tabs defaultValue="phone" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="phone"><Smartphone className="mr-1.5 h-4 w-4" /> Phone</TabsTrigger>
            <TabsTrigger value="email"><Mail className="mr-1.5 h-4 w-4" /> Email</TabsTrigger>
          </TabsList>

          {/* Phone OTP — default */}
          <TabsContent value="phone" className="space-y-4 pt-4">
            <div>
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="+256 7XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={otpSent || busy}
              />
            </div>
            {otpSent && (
              <div>
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={busy}
                />
              </div>
            )}
            {!otpSent ? (
              <Button onClick={sendOtp} disabled={busy || !phone} className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
              </Button>
            ) : (
              <Button
                onClick={() => run(() => auth.verifyPhoneOtp(phone, otp))}
                disabled={busy || (auth.supabaseEnabled && !otp)}
                className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
              </Button>
            )}
          </TabsContent>

          {/* Email / password */}
          <TabsContent value="email" className="space-y-4 pt-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
            </div>
            <Button
              onClick={() =>
                mode === "signin"
                  ? run(() => auth.signInWithEmail(email, password))
                  : run(
                      () => auth.signUpWithEmail(email, password, "buyer"),
                      doneAfterBuyerSignup,
                    )
              }
              disabled={busy || !email || !password}
              className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
            <button
              type="button"
              onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              {mode === "signin" ? "New here? Create a buyer account" : "Already have an account? Sign in"}
            </button>
            <Link
              to="/organizer/register"
              className="block text-center text-xs font-medium text-primary hover:underline"
            >
              Register as an organiser
            </Link>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
