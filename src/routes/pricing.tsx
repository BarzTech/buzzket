import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, CheckCircle2, CreditCard, ReceiptText, ShieldCheck } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { COMMISSION_FLAT_UGX, COMMISSION_PERCENT, feePerTicket, grossUpPerTicket } from "@/lib/fees";
import { formatUGX } from "@/lib/format";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Pricing — Buzzket" }] }),
  component: Pricing,
});

const examples = [20_000, 50_000, 100_000].map((price) => ({
  price,
  fee: feePerTicket(price),
  total: grossUpPerTicket(price),
}));

const platformPercent = Math.round(COMMISSION_PERCENT * 100);

function Pricing() {
  return (
    <PageShell
      title="Transparent ticket pricing"
      subtitle="Buzzket is free to start. Organizers set the ticket face value they want to receive, and buyers see a clear service and processing fee at checkout."
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-lg p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
              <ReceiptText className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-primary">Current commission</p>
              <h2 className="text-2xl font-bold text-foreground">
                {platformPercent}% + {formatUGX(COMMISSION_FLAT_UGX)} per ticket
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              The ticket price an organizer enters is treated as the organizer&apos;s face value. Buzzket then adds a service and processing fee to the buyer&apos;s checkout total.
            </p>
            <p>
              This means an organizer listing a ticket at {formatUGX(50_000)} receives {formatUGX(50_000)} for that ticket after the Buzzket commission is recovered from the buyer-facing fee.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Create event", "No setup fee"],
              ["Publish tickets", "No monthly subscription"],
              ["Paid ticket sale", `${platformPercent}% + ${formatUGX(COMMISSION_FLAT_UGX)}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-secondary/40 p-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-lg p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-cta/20 text-foreground">
              <Calculator className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-semibold text-foreground">How the fee is calculated</h2>
          </div>

          <div className="mt-6 rounded-lg border bg-background p-4 font-mono text-sm text-foreground">
            Buyer price = ceil((organizer price + {formatUGX(COMMISSION_FLAT_UGX)}) / {(1 - COMMISSION_PERCENT).toFixed(2)})
          </div>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            The formula grosses up the buyer price so that, after deducting {platformPercent}% and {formatUGX(COMMISSION_FLAT_UGX)}, the organizer keeps the original ticket price they set.
          </p>
        </Card>
      </div>

      <Card className="mt-6 rounded-lg p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">Examples</p>
            <h2 className="mt-1 text-2xl font-bold text-foreground">What buyers pay</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            The service and processing fee is shown separately during checkout, so buyers can see the ticket face value, the fee, and the final total before paying through Pesapal.
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border">
          <div className="grid grid-cols-3 bg-secondary/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Organizer price</span>
            <span>Service fee</span>
            <span className="text-right">Buyer pays</span>
          </div>
          {examples.map((row) => (
            <div key={row.price} className="grid grid-cols-3 border-t px-4 py-4 text-sm">
              <span className="font-medium text-foreground">{formatUGX(row.price)}</span>
              <span className="text-muted-foreground">{formatUGX(row.fee)}</span>
              <span className="text-right font-semibold text-foreground">{formatUGX(row.total)}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {[
          {
            icon: CheckCircle2,
            title: "Organizer-first net pricing",
            body: "Event owners can price tickets around the amount they need to receive, while Buzzket displays the buyer fee clearly before payment.",
          },
          {
            icon: CreditCard,
            title: "Pesapal payment processing",
            body: "Buyers are redirected to Pesapal for supported payment methods such as mobile money and cards. Payment confirmation issues the QR tickets.",
          },
          {
            icon: ShieldCheck,
            title: "Included platform tools",
            body: "The commission supports event hosting, checkout, reservation holds, QR ticket generation, dashboard reporting, and gate scanning.",
          },
        ].map((item) => (
          <Card key={item.title} className="rounded-lg p-6">
            <item.icon className="h-5 w-5 text-primary" />
            <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.body}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 rounded-lg p-6 sm:flex sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Ready to sell tickets?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an organizer account, publish your event, and start accepting paid reservations.
          </p>
        </div>
        <Button asChild className="mt-5 bg-cta text-cta-foreground hover:bg-cta/90 sm:mt-0">
          <Link to="/organizer/register">Start selling</Link>
        </Button>
      </Card>
    </PageShell>
  );
}
