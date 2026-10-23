import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";

import { Logo } from "@/components/logo";
import { useAuth } from "@/lib/auth/context";
import { bootstrapOrganizerProfile } from "@/lib/data/organizers";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeWhatsAppNumber } from "@/lib/payments/phone";
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
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (user?.email) setEmail(user.email);
      if (typeof user?.user_metadata?.name === "string") setName(user.user_metadata.name);
      if (typeof user?.user_metadata?.recovery_phone === "string") setRecoveryPhone(user.user_metadata.recovery_phone);
    });
  }, []);

  const startPhoneVerification = async (phone: string, displayName: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) throw new Error("Verify your email and sign in, then return here to verify the recovery phone.");

    if (session.user.phone === phone && session.user.phone_confirmed_at) {
      await bootstrapOrganizerProfile({ data: { accessToken: session.access_token, displayName, recoveryPhone: phone } });
      navigate({ to: "/dashboard" });
      return;
    }
    const { error: phoneError } = await supabase.auth.updateUser({ phone });
    if (phoneError) throw new Error(phoneError.message);
    setOtpSent(true);
    setSuccess(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      let phone: string;
      try { phone = normalizeWhatsAppNumber(recoveryPhone); }
      catch { throw new Error("Enter a valid international phone number, for example +2567XXXXXXXX."); }

      const supabase = getSupabaseBrowserClient();
      const { data: current } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (!current.session) {
        const { error: signUpError } = await auth.signUpWithEmail(email, password, {
          name: name.trim(),
          recovery_phone: phone,
        });
        if (signUpError) throw new Error(signUpError);
        const { data: afterSignup } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        if (!afterSignup.session) {
          setSuccess("Registration received. Verify your email and sign in, then return here to verify the recovery phone before organiser approval.");
          return;
        }
      }
      await startPhoneVerification(phone, name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const verifyPhone = async () => {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const phone = normalizeWhatsAppNumber(recoveryPhone);
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: otp.trim(), type: "phone_change" });
      if (verifyError) throw new Error(verifyError.message);
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Your session expired. Sign in again and retry phone verification.");
      await bootstrapOrganizerProfile({ data: { accessToken: data.session.access_token, displayName: name.trim(), recoveryPhone: phone } });
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Phone verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const resendPhoneOtp = async () => {
    setResending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error: resendError } = await supabase.auth.updateUser({ phone: normalizeWhatsAppNumber(recoveryPhone) });
      if (resendError) throw new Error(resendError.message);
      setSuccess("A new verification code has been requested. Supabase applies its configured resend limits.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend verification code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4">
      <Card className="w-full max-w-md p-7">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-bold text-lg"><Logo /></Link>
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/10"><Building2 className="h-6 w-6 text-primary" /></div>
        <h1 className="text-center text-xl font-bold">Register as an organiser</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">New organiser accounts require admin approval and a verified recovery phone.</p>
        {!auth.supabaseEnabled && <Alert variant="destructive" className="mt-4"><AlertDescription>Supabase is not configured. Organiser registration is disabled.</AlertDescription></Alert>}
        {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
        {success && <Alert className="mt-4 border-green-500 bg-green-500/10 text-green-700"><AlertDescription>{success}</AlertDescription></Alert>}

        {otpSent ? <div className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">Enter the SMS code sent to the recovery phone number.</p>
          <div><Label htmlFor="organizer-phone-otp">SMS verification code</Label><Input id="organizer-phone-otp" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value)} disabled={busy} /></div>
          <Button onClick={verifyPhone} disabled={busy || otp.trim().length < 4} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify phone and continue"}</Button>
          <Button type="button" variant="ghost" onClick={resendPhoneOtp} disabled={busy || resending} className="w-full">{resending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend code"}</Button>
        </div> : <div className="mt-6 space-y-4">
          <div><Label htmlFor="organizer-name">Organiser name</Label><Input id="organizer-name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy || !!success} /></div>
          <div><Label htmlFor="organizer-email">Email</Label><Input id="organizer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy || !!success || Boolean(auth.user)} /></div>
          {!auth.user && <div><Label htmlFor="organizer-password">Password</Label><Input id="organizer-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy || !!success} /></div>}
          <div>
            <Label htmlFor="organizer-recovery-phone">Recovery phone number</Label>
            <Input id="organizer-recovery-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+2567XXXXXXXX" value={recoveryPhone} onChange={(e) => setRecoveryPhone(e.target.value)} disabled={busy || !!success} required aria-describedby="organizer-recovery-help" />
            <p id="organizer-recovery-help" className="mt-1 text-xs text-muted-foreground">Use international format. This recovery number is separate from public event contacts and must be verified by SMS.</p>
          </div>
          <Button onClick={submit} disabled={busy || !!success || !name || !email || (!auth.user && !password) || !recoveryPhone} className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : auth.user ? "Verify recovery phone" : "Create organiser account"}
          </Button>
          <Link to="/login" search={{ redirect: "/organizer/register" }} className="block text-center text-xs text-muted-foreground hover:text-foreground">Already registered? Sign in</Link>
        </div>}
      </Card>
    </div>
  );
}
