import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Pricing — Buzzket" }] }),
  component: Pricing,
});

function Pricing() {
  return (
    <PageShell
      title="Simple pricing for every event"
      subtitle="Choose a plan that matches your event needs — no hidden fees and a transparent organizer-first experience."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-3xl p-8">
          <div className="text-xl font-semibold text-foreground">Free plan</div>
          <p className="mt-3 text-muted-foreground">Perfect for small community events and early testing.</p>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li>Free event creation</li>
            <li>Basic event promotion</li>
            <li>Simple ticket management</li>
          </ul>
        </Card>
        <Card className="rounded-3xl p-8">
          <div className="text-xl font-semibold text-foreground">Standard plan</div>
          <p className="mt-3 text-muted-foreground">Built for growing organizers with reliable ticket sales.</p>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li>Advanced event analytics</li>
            <li>Organizer dashboard access</li>
            <li>QR check-in support</li>
          </ul>
        </Card>
        <Card className="rounded-3xl p-8">
          <div className="text-xl font-semibold text-foreground">Enterprise</div>
          <p className="mt-3 text-muted-foreground">Custom support and premium event experiences.</p>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li>Priority support</li>
            <li>White-label branding</li>
            <li>Group ticketing</li>
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}
