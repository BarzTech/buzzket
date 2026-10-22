import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeWhatsAppNumber } from "@/lib/payments/phone";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { auditStaffRecoveryPhoneChange, authorizeStaffRecoveryPhoneChange } from "@/lib/data/staff-recovery";

export const Route = createFileRoute("/admin_/security")({
  head: () => ({ meta: [{ title: "Staff account security — Buzzket" }] }),
  component: StaffSecurity,
});

function StaffSecurity() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (!data.session?.access_token) return;
      try {
        const result = await authorizeStaffRecoveryPhoneChange({ data: { accessToken: data.session.access_token } });
        if (mounted) { setAuthorized(true); setHasPhone(result.hasVerifiedRecoveryPhone); }
      } catch (e) { if (mounted) setError(e instanceof Error ? e.message : "A recent staff email/password session is required."); }
    };
    void check();
    return () => { mounted = false; };
  }, []);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const cleanPhone = normalizeWhatsAppNumber(phone);
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Account security is temporarily unavailable.");
      const { error: updateError } = await supabase.auth.updateUser({ phone: cleanPhone });
      if (updateError) throw updateError;
      setPhone(cleanPhone);
      setOtpSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send a verification code."); }
    finally { setBusy(false); }
  };

  const verifyCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Account security is temporarily unavailable.");
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ phone, token: code.trim(), type: "phone_change" });
      if (verifyError || !data.session) throw verifyError ?? new Error("The code is invalid or expired.");
      await auditStaffRecoveryPhoneChange({ data: { accessToken: data.session.access_token } });
      setHasPhone(true);
      setSuccess(true);
      setOtpSent(false);
      setCode("");
    } catch (e) { setError(e instanceof Error ? e.message : "The code is invalid or expired."); }
    finally { setBusy(false); }
  };

  return <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4 py-8"><Card className="w-full max-w-md p-7">
    <Link to="/admin/login" search={{ redirect: "/admin" }} className="mb-6 flex items-center justify-center gap-2 font-bold text-lg"><Logo /></Link>
    <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/10"><ShieldCheck className="h-6 w-6 text-primary" /></div>
    <h1 className="text-center text-xl font-bold">Staff recovery phone</h1>
    <p className="mt-2 text-center text-sm text-muted-foreground">Register or update the verified phone used for staff password recovery.</p>
    {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
    {success && <Alert className="mt-4"><AlertDescription>Your verified recovery phone is set. A hash-only audit record was saved.</AlertDescription></Alert>}
    {!authorized ? <p className="mt-6 text-sm text-muted-foreground">Sign in with your staff email and password, then open this page again. Customer accounts are not eligible.</p> : <div className="mt-6 space-y-4">
      {hasPhone && <p className="text-sm text-muted-foreground">A verified recovery phone is already registered. Enter a new number below to replace it; the number will only be saved after SMS verification.</p>}
      <div><Label htmlFor="staff-recovery-phone">Phone number</Label><Input id="staff-recovery-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+256 7XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy || otpSent} /><p className="mt-1 text-xs text-muted-foreground">Enter an international number. Supabase sends a verification code to that number before linking it to your signed-in staff account.</p></div>
      {otpSent && <div><Label htmlFor="staff-phone-code">SMS verification code</Label><Input id="staff-phone-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} /></div>}
      {!otpSent ? <Button onClick={() => void sendCode()} disabled={busy || !phone.trim()} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send verification code"}</Button> : <Button onClick={() => void verifyCode()} disabled={busy || !code.trim()} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify and save phone"}</Button>}
    </div>}
    <Link to="/admin/login" search={{ redirect: "/admin" }} className="mt-5 block text-center text-sm text-muted-foreground underline">Back to staff sign in</Link>
  </Card></div>;
}
