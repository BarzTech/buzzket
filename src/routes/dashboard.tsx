import { createFileRoute, Link } from "@tanstack/react-router";
import { EVENTS } from "@/lib/mock-events";
import { Navbar } from "@/components/navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LayoutDashboard, Calendar, Ticket, TrendingUp, Users, Settings, Edit3, Eye } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Organizer Dashboard — Buzzket" },
      { name: "description", content: "Manage your events, track ticket sales and view analytics." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [tab, setTab] = useState<"overview" | "events">("overview");

  const ticketsSold = 312;
  const totalSales = 9_420_000;
  // Platform commission: 5% + UGX 500 per ticket
  const platformCommission = Math.round(totalSales * 0.05) + ticketsSold * 500;
  const organizerPayout = totalSales - platformCommission;
  const stats = {
    totalSales,
    ticketsSold,
    totalEvents: EVENTS.length,
    attendees: 287,
    platformCommission,
    organizerPayout,
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 md:block">
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 font-bold text-primary">
              <LayoutDashboard className="h-5 w-5" /> Organizer
            </div>
            <Separator className="my-2" />
            <nav className="space-y-1">
              {[
                { id: "overview" as const, icon: TrendingUp, label: "Overview" },
                { id: "events" as const, icon: Calendar, label: "My Events" },
                { id: "tickets" as const, icon: Ticket, label: "Tickets" },
                { id: "attendees" as const, icon: Users, label: "Attendees" },
                { id: "settings" as const, icon: Settings, label: "Settings" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id as typeof tab)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    tab === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" /> {item.label}
                </button>
              ))}
            </nav>
          </Card>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {tab === "overview" && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Dashboard Overview</h1>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Total Sales (UGX)", value: new Intl.NumberFormat("en-UG").format(stats.totalSales), sub: "+12% vs last month", accent: true },
                  { label: "Tickets Sold", value: String(stats.ticketsSold), sub: "+8% vs last month", accent: false },
                  { label: "Active Events", value: String(stats.totalEvents), sub: "3 upcoming", accent: false },
                  { label: "Attendees", value: String(stats.attendees), sub: "Confirmed check-ins", accent: false },
                ].map((s) => (
                  <Card key={s.label} className={`p-5 ${s.accent ? "bg-primary text-primary-foreground" : ""}`}>
                    <div className="text-sm opacity-80">{s.label}</div>
                    <div className="mt-1 text-2xl font-bold">{s.value}</div>
                    <div className="mt-1 text-xs opacity-70">{s.sub}</div>
                  </Card>
                ))}
              </div>

              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Payout Breakdown</div>
                    <div className="mt-1 text-xs text-muted-foreground">Buzzket commission: 5% + UGX 500 per ticket · Paid out via PesaPay</div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Platform fee</div>
                      <div className="font-bold">UGX {new Intl.NumberFormat("en-UG").format(stats.platformCommission)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Your net payout</div>
                      <div className="font-bold text-primary">UGX {new Intl.NumberFormat("en-UG").format(stats.organizerPayout)}</div>
                    </div>
                  </div>
                </div>
              </Card>

              <h2 className="text-lg font-semibold mt-6">Recent Activity</h2>
              <Card className="divide-y">
                {EVENTS.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex items-center gap-4 p-4">
                    <img src={e.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{e.title}</div>
                      <div className="text-xs text-muted-foreground">{e.city} · {e.category}</div>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/events/$eventId" params={{ eventId: e.id }}><Eye className="mr-1 h-3.5 w-3.5" /> View</Link>
                    </Button>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {tab === "events" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">My Events</h1>
                <Button className="bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">+ Create Event</Button>
              </div>
              <Card className="divide-y">
                {EVENTS.map((e) => (
                  <div key={e.id} className="flex items-center gap-4 p-4">
                    <img src={e.image} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{e.title}</div>
                      <div className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString("en-UG")} · {e.venue}</div>
                    </div>
                    <Button variant="outline" size="sm"><Edit3 className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
