import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/sell-tickets")({
  head: () => ({ meta: [{ title: "Sell Tickets — Buzzket" }] }),
  component: SellTickets,
});

function SellTickets() {
  return (
    <PageShell
      title="Sell tickets with Buzzket"
      subtitle="Reach thousands of event-goers with a trusted ticketing experience built for Uganda."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl p-8">
          <h2 className="text-2xl font-semibold text-foreground">Simple ticket creation</h2>
          <p className="mt-4 text-muted-foreground">
            Add your event, choose ticket tiers, and publish instantly. Manage inventory and track sales from your dashboard.
          </p>
        </Card>
        <Card className="rounded-3xl p-8">
          <h2 className="text-2xl font-semibold text-foreground">Sell more tickets</h2>
          <p className="mt-4 text-muted-foreground">
            Promote your event to a growing audience and manage attendee check-in with our built-in scanning tools.
          </p>
        </Card>
      </div>

      <Card className="mt-8 rounded-3xl p-8 text-center">
        <p className="text-lg font-medium text-foreground">Ready to start selling?</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in to your organizer account to create your first event and start accepting reservations.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild className="rounded-xl bg-cta text-cta-foreground hover:bg-cta/90 px-6 py-3">
            <Link to="/login" search={{ redirect: "/dashboard" }}>
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
