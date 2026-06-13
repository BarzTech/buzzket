import { createFileRoute } from "@tanstack/react-router";
import { EVENTS, CATEGORIES, formatDate } from "@/lib/mock-events";
import { EventCard } from "@/components/event-card";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { Search, TrendingUp, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Buzzket — Discover Events in Uganda" },
      { name: "description", content: "Find and buy tickets for the best events in Kampala and across Uganda. Music, festivals, comedy, sports and more." },
      { property: "og:title", content: "Buzzket — Discover Events in Uganda" },
      { property: "og:description", content: "Find and buy tickets for the best events in Kampala and across Uganda." },
    ],
  }),
  component: Index,
});

function Index() {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return EVENTS.filter((e) => {
      const matchesCat = activeCat === "All" || e.category === activeCat;
      const matchesSearch =
        !term ||
        e.title.toLowerCase().includes(term) ||
        e.category.toLowerCase().includes(term) ||
        e.venue.toLowerCase().includes(term) ||
        e.city.toLowerCase().includes(term);
      return matchesCat && matchesSearch;
    });
  }, [search, activeCat]);

  const featured = EVENTS.filter((e) => e.featured);
  const happeningSoon = EVENTS.filter((e) => !e.featured);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-20">
          <img
            src="https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1600&q=60"
            alt="Crowd at an event"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-24 md:py-32">
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Discover amazing events <br className="hidden md:block" /> across Uganda
          </h1>
          <p className="mt-4 max-w-xl text-lg opacity-90">
            Buy tickets in seconds for concerts, festivals, comedy shows and more.
          </p>
          <div className="mt-8 flex max-w-xl items-center gap-2 rounded-2xl bg-primary-foreground p-2 shadow-2xl">
            <div className="flex flex-1 items-center gap-2 pl-2">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by event name or category..."
                className="border-0 bg-transparent text-foreground shadow-none ring-0 focus-visible:ring-0"
              />
            </div>
            <Button className="bg-cta text-cta-foreground hover:bg-cta/90 font-semibold rounded-xl px-6">
              Search
            </Button>
          </div>
        </div>
      </section>

      {/* Category pills */}
      <div className="mx-auto max-w-7xl px-4 pt-10">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCat === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-8">
          <div className="mb-4 flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-5 w-5 text-cta" /> Featured Events
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {featured.map((event) => (
              <div key={event.id} className="w-[260px] shrink-0 md:w-[320px]">
                <EventCard event={event} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Happening Soon */}
      <section id="happening-soon" className="mx-auto max-w-7xl px-4 pt-10">
        <div className="mb-4 flex items-center gap-2 text-xl font-bold">
          <TrendingUp className="h-5 w-5 text-primary" /> Happening Soon
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-xl border p-12 text-center text-muted-foreground">
            No events found for "{search}".
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
