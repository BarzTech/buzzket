import { Link } from "@tanstack/react-router";
import { AlertTriangle, Settings2 } from "lucide-react";

export function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">We&apos;ll be right back</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Buzzket is temporarily down for scheduled maintenance. Ticket purchases and event browsing are paused until we&apos;re back online.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Settings2 className="h-4 w-4" />
            Admin sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
