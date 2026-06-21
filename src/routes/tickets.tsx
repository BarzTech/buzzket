import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Ticket as TicketIcon } from "lucide-react";

import { requireAuthOrRedirect } from "@/lib/auth/guard";
import { myTicketsQueryOptions } from "@/lib/data/customer-tickets";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { Ticket } from "@/components/ticket";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tickets")({
  beforeLoad: ({ location }) => requireAuthOrRedirect(location.href),
  head: () => ({
    meta: [
      { title: "My Tickets - Buzzket" },
      { name: "description", content: "View and download your purchased event tickets." },
    ],
  }),
  component: MyTickets,
});

function MyTickets() {
  const [accessToken, setAccessToken] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? "");
    });
  }, []);

  const { data: tickets = [], isLoading, isFetching } = useQuery({
    ...myTicketsQueryOptions(accessToken || "pending"),
    enabled: Boolean(accessToken),
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Tickets</h1>
            <p className="text-muted-foreground mt-1">
              View, print, or download your purchased tickets. Show the QR codes at the gate.
            </p>
          </div>
          {isFetching && !isLoading && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>

        {!accessToken && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p>Verifying session...</p>
          </div>
        )}

        {accessToken && isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p>Loading your tickets...</p>
          </div>
        )}

        {accessToken && !isLoading && tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
              <TicketIcon className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No tickets found</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              You haven&apos;t purchased any tickets yet. Explore Ugandan events and book your spot!
            </p>
            <Button asChild className="mt-6 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold px-6">
              <Link to="/">Discover Events</Link>
            </Button>
          </div>
        )}

        {accessToken && !isLoading && tickets.length > 0 && (
          <div className="space-y-8">
            {tickets.map((ticket) => (
              <Ticket
                key={ticket.id}
                eventTitle={ticket.event.title}
                date={ticket.event.date}
                venue={ticket.event.venue}
                city={ticket.event.city}
                image={ticket.event.image}
                tier={ticket.tier}
                holder={ticket.holder}
                price={ticket.price}
                qrToken={ticket.qrToken}
                issuedTicket={ticket}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
