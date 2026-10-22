import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Eye, EyeOff, Smartphone } from "lucide-react";

import { Logo } from "@/components/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  beginStaffPasswordRecovery,
  setStaffPasswordWithRecoveryGrant,
  verifyStaffPasswordRecoveryCode,
} from "@/lib/data/staff-recovery";

export const Route = createFileRoute("/admin_/forgot-password")({
  head: () => ({ meta: [{ title: "Staff password recovery — Buzzket" }] }),
  component: StaffPasswordRecovery,
});

type Phase = "email" | "code" | "password" | "success";

function StaffPasswordRecovery() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (phase !== "code" || resendAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [phase, resendAt]);

  const requestCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await beginStaffPasswordRecovery({ data: { email: email.trim() } });
      setCode("");
      setResendAt(Date.now() + 30_000);
      setPhase("code");
    } catch {
      setError("We could not process the request. Check the email format or try again later.");
    } finally { setBusy(false); }
  };

  const verifyCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await verifyStaffPasswordRecoveryCode({ data: { email: email.trim(), code: code.trim() } });
      setRecoveryToken(result.recoveryToken);
      setCode("");
      setPhase("password");
    } catch {
      setError("That code is invalid or expired. If you cannot receive a code, contact Buzzket support for authorized account recovery.");
    } finally { setBusy(false); }
  };

  const resetPassword = async () => {
    setError(null);
    if (password.length < 12) return setError("Use at least 12 characters for your new password.");
    if (password !== confirm) return setError("The passwords do not match.");
    if (!recoveryToken) return setError("Your recovery session expired. Start again from staff sign-in.");
    setBusy(true);
    try {
      await setStaffPasswordWithRecoveryGrant({ data: { recoveryToken, password } });
      setRecoveryToken(null);
      setPassword("");
      setConfirm("");
      setPhase("success");
    } catch (e) {
      setRecoveryToken(null);
      setPhase("email");
      setError(e instanceof Error ? e.message : "The password could not be updated. Start recovery again.");
    } finally { setBusy(false); }
  };

  const title = phase === "success" ? "Password updated" : "Staff password recovery";
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4 py-8">
      <Card className="w-full max-w-md p-7">
        <Link to="/admin/login" search={{ redirect: "/admin" }} className="mb-6 flex items-center justify-center gap-2 font-bold text-lg"><Logo /></Link>
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/10"><Smartphone className="h-6 w-6 text-primary" /></div>
        <h1 className="text-center text-xl font-bold">{title}</h1>
        {phase === "email" && <p className="mt-2 text-center text-sm text-muted-foreground">Enter your staff account email. If the account is eligible, we’ll send a code to its verified recovery phone.</p>}
        {phase === "code" && <p className="mt-2 text-center text-sm text-muted-foreground">If the account is eligible, a verification code was sent to its registered phone. We do not display the phone number. If no code arrives, contact Buzzket support for authorized account recovery.</p>}
        {phase === "password" && <p className="mt-2 text-center text-sm text-muted-foreground">Choose a new password for this verified staff account.</p>}
        {phase === "success" && <p className="mt-2 text-center text-sm text-muted-foreground">Your password was changed. Sign in with your staff email and new password.</p>}
        {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}

        {phase === "email" && <div className="mt-6 space-y-4">
          <div><Label htmlFor="staff-recovery-email">Staff email</Label><Input id="staff-recovery-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} /></div>
          <Button onClick={() => void requestCode()} disabled={busy || !email.trim()} className="w-full bg-cta text-cta-foreground hover:bg-cta/90">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}</Button>
        </div>}

        {phase === "code" && <div className="mt-6 space-y-4">
          <div><Label htmlFor="staff-recovery-code">SMS verification code</Label><Input id="staff-recovery-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} /></div>
          <Button onClick={() => void verifyCode()} disabled={busy || !code.trim()} className="w-full bg-cta text-cta-foreground hover:bg-cta/90">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify code"}</Button>
          <Button variant="outline" onClick={() => void requestCode()} disabled={busy || now < resendAt} className="w-full">{now < resendAt ? `Resend available in ${Math.ceil((resendAt - now) / 1000)}s` : "Resend code"}</Button>
          <Button variant="ghost" onClick={() => { setPhase("email"); setError(null); }} className="w-full">Use a different email</Button>
        </div>}

        {phase === "password" && <div className="mt-6 space-y-4">
          <div><Label htmlFor="staff-new-password">New password</Label><div className="flex gap-2"><Input id="staff-new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /><Button type="button" variant="outline" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((show) => !show)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
          <div><Label htmlFor="staff-confirm-password">Confirm new password</Label><div className="flex gap-2"><Input id="staff-confirm-password" type={showConfirm ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} disabled={busy} /><Button type="button" variant="outline" aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"} onClick={() => setShowConfirm((show) => !show)}>{showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
          <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>
          <Button onClick={() => void resetPassword()} disabled={busy || !password || !confirm} className="w-full bg-cta text-cta-foreground hover:bg-cta/90">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set new password"}</Button>
        </div>}

        {phase === "success" && <Button className="mt-6 w-full" onClick={() => navigate({ to: "/admin/login", search: { redirect: "/admin" } })}>Return to staff sign in</Button>}
        {phase !== "success" && <Link to="/admin/login" search={{ redirect: "/admin" }} className="mt-5 block text-center text-sm text-muted-foreground underline">Back to staff sign in</Link>}
      </Card>
    </div>
  );
}
