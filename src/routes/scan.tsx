import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ScanLine, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";

import { requireAuthOrRedirect } from "@/lib/auth/guard";
import { checkInTicket, type CheckInResult } from "@/lib/data/tickets";
import { Navbar } from "@/components/navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/scan")({
  head: () => ({ meta: [{ title: "Ticket Scanning — Buzzket" }] }),
  beforeLoad: ({ location }) => requireAuthOrRedirect(location.href),
  component: Scan,
});

function Scan() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await checkInTicket({ data: { token: token.trim() } });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-6 flex items-center gap-2 text-xl font-bold">
          <ScanLine className="h-5 w-5 text-primary" /> Ticket Scanning
        </div>

        <Card className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Scan an attendee QR code or paste its token below to check them in.
          </p>
          <div>
            <Label htmlFor="token">Ticket token</Label>
            <Input
              id="token"
              placeholder="e.g. 3f2c1a9e-..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <Button
            onClick={submit}
            disabled={busy || !token.trim()}
            className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check in"}
          </Button>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <XCircle className="h-5 w-5" /> {error}
            </div>
          )}

          {result?.status === "valid" && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" /> Checked in{result.holder ? `: ${result.holder}` : ""}.
            </div>
          )}
          {result?.status === "demo" && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm text-primary">
              <CheckCircle2 className="h-5 w-5" /> Demo mode — would check in {result.holder}. Connect Supabase for live validation.
            </div>
          )}
          {result?.status === "already_used" && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" /> Already used{result.holder ? ` by ${result.holder}` : ""}.
            </div>
          )}
          {result?.status === "not_found" && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <XCircle className="h-5 w-5" /> Invalid ticket — not found.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
