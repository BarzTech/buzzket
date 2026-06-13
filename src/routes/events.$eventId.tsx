import { createFileRoute, Link } from "@tanstack/react-router";
import { getEvent, formatDate, formatUGX } from "@/lib/mock-events";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, MapPin, Clock, User, Ticket, Share2, MapPin as MapIcon } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/events/$eventId")({
  head: ({ params }) => {
    const event = getEvent(params.eventId);
    return {
      meta: [
        { title: event ? `${event.title} — Buzzket` : "Event — Buzzket" },
        { name: "description", content: event?.description.slice(0, 160) || "" },
        { property: "og:title", content: event?.title || "" },
        { property: "og:description", content: event?.description.slice(0, 160) || "" },
        { property: "og:image", content: event?.image || "" },
      ],
    };
  },
  component: EventDetail,
});

const TIERS = [
  { label: "Regular", price: (from: number) => from },
  { label: "VIP", price: (from: number) => from * 2.5 },
  { label: "Early Bird", price: (from: number) => from * 0.7 },
];

function EventDetail() {
  const { eventId } = Route.useParams();
  const event = useMemo(() => getEvent(eventId), [eventId]);
  const [qty, setQty] = useState(1);
  const [tier, setTier] = useState(TIERS[0]);

  if (!event) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-24 text-center text-muted-foreground">Event not found.</div>
      </div>
    );
  }

  const unitPrice = tier.price(event.priceFrom);
  const total = unitPrice * qty;

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero image */}
      <div className="relative h-56 md:h-80">
        <img src={event.image} alt={event.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-24">
        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_340px]">
          {/* Left column */}
          <div>
            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {event.category}
            </span>
            <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">{event.title}</h1>

            <div className="mt-5 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-3"><Calendar className="h-5 w-5 text-primary" />{formatDate(event.date)}</div>
              <div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-primary" />{event.venue}, {event.city}</div>
              <div className="flex items-center gap-3"><Clock className="h-5 w-5 text-primary" />Doors open at {new Date(event.date).toLocaleTimeString("en-UG", { hour: "numeric", minute: "2-digit" })}</div>
            </div>

            <Separator className="my-6" />

            <h3 className="text-lg font-semibold">About</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">{event.description}</p>

            <Separator className="my-6" />

            {/* Organizer */}
            <h3 className="text-lg font-semibold">Organizer</h3>
            <div className="mt-3 flex items-center gap-4">
              <img src={event.organizer.avatar} alt={event.organizer.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/20" />
              <div>
                <div className="font-medium">{event.organizer.name}</div>
                <div className="text-xs text-muted-foreground">Verified organizer</div>
              </div>
              <Button variant="outline" className="ml-auto text-sm">Follow</Button>
            </div>

            <Separator className="my-6" />

            {/* Location Map Placeholder */}
            <h3 className="text-lg font-semibold">Location</h3>
            <div className="mt-3 grid h-56 place-items-center rounded-xl bg-secondary text-muted-foreground ring-1 ring-border">
              <div className="text-center">
                <MapIcon className="mx-auto mb-2 h-8 w-8 text-primary/60" />
                <p className="text-sm">{event.venue}, {event.city}</p>
                <p className="text-xs opacity-70">Google Maps embed placeholder</p>
              </div>
            </div>
          </div>

          {/* Right sticky sidebar */}
          <div className="relative">
            <Card className="sticky top-24 p-5">
              <h3 className="font-semibold">Buy Tickets</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Ticket type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {TIERS.map((t) => (
                      <button
                        key={t.label}
                        onClick={() => setTier(t)}
                        className={`rounded-lg border px-2 py-3 text-center text-sm font-semibold transition-all ${
                          tier.label === t.label
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground hover:bg-accent"
                        }`}
                      >
                        <div className="text-[10px] font-normal opacity-70">{t.label}</div>
                        {formatUGX(t.price(event.priceFrom))}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border font-bold"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                    >-</button>
                    <span className="w-8 text-center font-semibold">{qty}</span>
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border font-bold"
                      onClick={() => setQty((q) => Math.min(10, q + 1))}
                    >+</button>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold">{formatUGX(total)}</span>
                </div>

                <Button
                  asChild
                  className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"
                >
                  <Link to="/checkout/$eventId" params={{ eventId: event.id }} search={{ tier: tier.label, qty: String(qty) }}>
                    <Ticket className="mr-2 h-4 w-4" /> Buy Tickets
                  </Link>
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 text-sm"><Share2 className="mr-1.5 h-4 w-4" /> Share</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
