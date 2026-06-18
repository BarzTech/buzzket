import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { eventsQueryOptions } from "@/lib/data/events";
import { CATEGORIES } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories — Buzzket" }] }),
  loader: ({ context }) => context.queryClient.fetchQuery(eventsQueryOptions()),
  component: Categories,
});

function Categories() {
  const { data: events = [] } = useQuery(eventsQueryOptions());

  const categoryCounts = useMemo(
    () =>
      CATEGORIES.filter((category) => category !== "All").map((category) => ({
        category,
        count: events.filter((event) => event.category === category).length,
      })),
    [events],
  );

  return (
    <PageShell
      title="Browse by category"
      subtitle="Discover events grouped by category so it’s easy to find music, festivals, conferences and more."
    >
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {categoryCounts.map(({ category, count }) => (
          <Card key={category} className="rounded-3xl p-6">
            <div className="text-xl font-semibold text-foreground">{category}</div>
            <div className="mt-3 text-sm text-muted-foreground">
              {count} event{count === 1 ? "" : "s"} available
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
