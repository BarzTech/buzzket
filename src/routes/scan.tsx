import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

import { requireRoleOrRedirect } from "@/lib/auth/guard";
import { checkInTicketClient, type CheckInResult } from "@/lib/data/tickets";
import { Navbar } from "@/components/navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/scan")({
  head: () => ({ meta: [{ title: "Ticket Scanning — Buzzket" }] }),
  beforeLoad: ({ location }) => requireRoleOrRedirect(["organizer", "admin"], location.href),
  component: Scan,
});

function Scan() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef("");

  const submit = async (value = token) => {
    const clean = value.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await checkInTicketClient(clean);
      setResult(res);
      setToken("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const stopCamera = () => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("This browser cannot access the camera. Use manual token entry on this device.");
        return;
      }
      if (!videoRef.current) return;

      const reader = new BrowserQRCodeReader();
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      const rearCamera =
        devices.find((device) => /back|rear|environment/i.test(device.label)) ??
        devices[devices.length - 1] ??
        devices[0];

      const controls = await reader.decodeFromVideoDevice(
        rearCamera?.deviceId,
        videoRef.current,
        (scanResult) => {
          const value = scanResult?.getText().trim();
          if (!value || value === lastScanRef.current || busy) return;
          lastScanRef.current = value;
          void submit(value).finally(() => {
            window.setTimeout(() => {
              lastScanRef.current = "";
            }, 1500);
          });
        },
      );
      scannerControlsRef.current = controls;
      streamRef.current = videoRef.current.srcObject as MediaStream | null;
      setCameraActive(true);
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : "Could not access camera.");
      stopCamera();
    }
  };

  useEffect(() => stopCamera, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-6 flex items-center gap-2 text-xl font-bold">
          <ScanLine className="h-5 w-5 text-primary" /> Ticket Scanning
        </div>

        <Card className="space-y-4 p-6">
          <div className="overflow-hidden rounded-xl border bg-black">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={cameraActive ? stopCamera : startCamera}
              variant={cameraActive ? "outline" : "default"}
              className={cameraActive ? "" : "bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"}
            >
              <Camera className="mr-2 h-4 w-4" />
              {cameraActive ? "Stop camera" : "Start camera"}
            </Button>
            <Button variant="outline" onClick={() => setResult(null)} disabled={!result}>
              Clear result
            </Button>
          </div>
          {cameraError && (
            <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              {cameraError}
            </div>
          )}
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
          {result?.status === "already_used" && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" /> Already used{result.holder ? ` by ${result.holder}` : ""}.
            </div>
          )}
          {result?.status === "forbidden" && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <XCircle className="h-5 w-5" /> This scanner is not authorised for that event.
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
