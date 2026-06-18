import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy — Buzzket" }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <PageShell
      title="Privacy policy"
      subtitle="Read how Buzzket protects your personal information and keeps your ticketing data secure."
    >
      <Card className="rounded-3xl p-8">
        <h2 className="text-xl font-semibold text-foreground">Your privacy matters</h2>
        <p className="mt-4 text-muted-foreground">
          We only use your information to power event discovery, ticket purchases, and organizer communications.
        </p>
        <p className="mt-4 text-muted-foreground">
          We do not sell your data. Your account details and ticket history remain private.
        </p>
      </Card>
    </PageShell>
  );
}
