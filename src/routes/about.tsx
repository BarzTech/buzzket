import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — Buzzket" }] }),
  component: About,
});

function About() {
  return (
    <PageShell
      title="About Buzzket"
      subtitle="A ticketing platform built for Uganda’s events, communities, and creators."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl p-8">
          <h2 className="text-xl font-semibold text-foreground">Our mission</h2>
          <p className="mt-4 text-muted-foreground">
            We make it easy for Ugandan organisers to launch events, sell tickets, and deliver memorable experiences.
          </p>
        </Card>
        <Card className="rounded-3xl p-8">
          <h2 className="text-xl font-semibold text-foreground">Our values</h2>
          <ul className="mt-4 space-y-3 text-muted-foreground">
            <li>Trustworthy experiences</li>
            <li>Local-first products</li>
            <li>Simple tools for every organiser</li>
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}
