import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/resources")({
  head: () => ({ meta: [{ title: "Resources — Buzzket" }] }),
  component: Resources,
});

function Resources() {
  return (
    <PageShell
      title="Organizer resources"
      subtitle="Everything you need to create, promote, and manage successful events in Uganda."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-3xl p-8">
          <h2 className="text-xl font-semibold text-foreground">Event guides</h2>
          <p className="mt-3 text-muted-foreground">
            Practical advice for planning venues, ticket pricing, and audience engagement.
          </p>
        </Card>
        <Card className="rounded-3xl p-8">
          <h2 className="text-xl font-semibold text-foreground">Marketing tips</h2>
          <p className="mt-3 text-muted-foreground">
            Grow visibility with social promotion, email messaging, and offline campaigns.
          </p>
        </Card>
        <Card className="rounded-3xl p-8">
          <h2 className="text-xl font-semibold text-foreground">Support articles</h2>
          <p className="mt-3 text-muted-foreground">
            Learn about payments, ticketing, event setup, and attendee management.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
