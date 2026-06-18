import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { eventsQueryOptions } from "@/lib/data/events";
import { CATEGORIES } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { EventCard } from "@/components/event-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/browse")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  head: () => ({ meta: [{ title: "Browse Events — Buzzket" }] }),
  loader: ({ context }) => context.queryClient.fetchQuery(eventsQueryOptions()),
  component: Browse,
});

function Browse() {
  const { q } = Route.useSearch();
  const [search, setSearch] = useState(q);
  const [activeCategory, setActiveCategory] = useState("All");
  const { data: events = [], isLoading } = useQuery(eventsQueryOptions());

  useEffect(() => {
    setSearch(q);
  }, [q]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesCategory = activeCategory === "All" || event.category === activeCategory;
      const matchesSearch =
        !term ||
        event.title.toLowerCase().includes(term) ||
        event.category.toLowerCase().includes(term) ||
        event.venue.toLowerCase().includes(term) ||
        event.city.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [events, activeCategory, search]);

  return (
    <PageShell
      title="Browse events"
      subtitle="Explore all available events in Uganda. Use search and categories to narrow down what you want to attend."
    >
      <div className="mb-10 grid gap-4 sm:grid-cols-[1fr_auto] items-end">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => event.preventDefault()}
          className="flex w-full max-w-xl items-center gap-2"
        >
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search events, venues, or cities"
            className="flex-1"
          />
          <Button type="submit" className="rounded-xl px-6">
            <Search className="mr-2 h-4 w-4" /> Search
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-border bg-background/80 p-12 text-center text-muted-foreground">
          No events matched your search. Try another keyword or category.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
