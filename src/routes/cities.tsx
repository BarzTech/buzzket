import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { eventsQueryOptions } from "@/lib/data/events";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/cities")({
  head: () => ({ meta: [{ title: "Cities — Buzzket" }] }),
  loader: ({ context }) => context.queryClient.fetchQuery(eventsQueryOptions()),
  component: Cities,
});

function Cities() {
  const { data: events = [] } = useQuery(eventsQueryOptions());

  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((event) => {
      counts[event.city] = (counts[event.city] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [events]);

  return (
    <PageShell
      title="Browse by city"
      subtitle="Explore events happening in different cities across Uganda."
    >
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {cityCounts.map(([city, count]) => (
          <Card key={city} className="rounded-3xl p-6">
            <div className="text-xl font-semibold text-foreground">{city}</div>
            <div className="mt-3 text-sm text-muted-foreground">
              {count} event{count === 1 ? "" : "s"} happening soon
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
