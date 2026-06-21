import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Banknote,
  Calendar,
  CheckCircle2,
  Edit3,
  Eye,
  LayoutDashboard,
  Loader2,
  Settings,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";

import { requireRoleOrRedirect } from "@/lib/auth/guard";
import { getStoredUser } from "@/lib/auth/session";
import { dashboardStatsQueryOptions } from "@/lib/data/dashboard";
import { eventsQueryOptions } from "@/lib/data/events";
import {
  organizerAttendeesQueryOptions,
  organizerFinanceQueryOptions,
  organizerProfileQueryOptions,
  organizerSalesQueryOptions,
  payoutRequestsQueryOptions,
  requestPayout,
  saveMyOrganizerProfile,
  type OrganizerProfile,
} from "@/lib/data/organizers";
import { formatUGX } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type Tab = "overview" | "events" | "sales" | "attendees" | "payouts" | "settings";

type ProfileForm = Pick<
  OrganizerProfile,
  "displayName" | "bio" | "avatarUrl" | "phone" | "website" | "payoutMethod" | "payoutAccount"
>;

const emptyProfile: ProfileForm = {
  displayName: "",
  bio: "",
  avatarUrl: "",
  phone: "",
  website: "",
  payoutMethod: "MTN Mobile Money",
  payoutAccount: "",
};

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Organizer Dashboard - Buzzket" },
      { name: "description", content: "Manage events, sales, attendees, payouts, and organiser settings." },
    ],
  }),
  beforeLoad: ({ location }) => requireRoleOrRedirect(["organizer", "admin"], location.href),
  loader: ({ context }) => {
    const user = typeof window !== "undefined" ? getStoredUser() : null;
    const organizerId = user?.role === "admin" ? undefined : user?.id;
    return Promise.all([
      context.queryClient.fetchQuery(eventsQueryOptions(organizerId)),
      context.queryClient.fetchQuery(dashboardStatsQueryOptions(organizerId)),
    ]);
  },
  component: Dashboard,
});

function Dashboard() {
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const organizerId = user?.role === "admin" ? undefined : user?.id;
  const [tab, setTab] = useState<Tab>("overview");
  const [accessToken, setAccessToken] = useState("");
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfile);
  const [profileSaved, setProfileSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? "");
    });
  }, []);

  const { data: events = [] } = useQuery(eventsQueryOptions(organizerId));
  const { data: stats } = useQuery(dashboardStatsQueryOptions(organizerId));
  const profileQuery = useQuery({
    ...organizerProfileQueryOptions(accessToken || "pending"),
    enabled: Boolean(accessToken),
  });
  const financeQuery = useQuery({
    ...organizerFinanceQueryOptions(accessToken || "pending"),
    enabled: Boolean(accessToken),
  });
  const salesQuery = useQuery({
    ...organizerSalesQueryOptions(accessToken || "pending"),
    enabled: Boolean(accessToken),
  });
  const attendeesQuery = useQuery({
    ...organizerAttendeesQueryOptions(accessToken || "pending"),
    enabled: Boolean(accessToken),
  });
  const payoutsQuery = useQuery({
    ...payoutRequestsQueryOptions(accessToken || "pending"),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setProfileForm({
      displayName: profileQuery.data.displayName,
      bio: profileQuery.data.bio,
      avatarUrl: profileQuery.data.avatarUrl,
      phone: profileQuery.data.phone,
      website: profileQuery.data.website,
      payoutMethod: profileQuery.data.payoutMethod,
      payoutAccount: profileQuery.data.payoutAccount,
    });
  }, [profileQuery.data]);

  const invalidateOrganizerQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["organizer-profile", accessToken] });
    queryClient.invalidateQueries({ queryKey: ["organizer-finance", accessToken] });
    queryClient.invalidateQueries({ queryKey: ["payout-requests", accessToken] });
    queryClient.invalidateQueries({ queryKey: ["events", { organizerId }] });
  };

  const saveProfileMutation = useMutation({
    mutationFn: () => saveMyOrganizerProfile({ data: { accessToken, ...profileForm } }),
    onSuccess: () => {
      setProfileSaved(true);
      invalidateOrganizerQueries();
      window.setTimeout(() => setProfileSaved(false), 2500);
    },
  });

  const requestPayoutMutation = useMutation({
    mutationFn: () =>
      requestPayout({
        data: {
          accessToken,
          amount: Number(payoutAmount),
          note: payoutNote,
        },
      }),
    onSuccess: () => {
      setPayoutAmount("");
      setPayoutNote("");
      invalidateOrganizerQueries();
    },
  });

  const finance = financeQuery.data;
  const sales = salesQuery.data ?? [];
  const attendees = attendeesQuery.data ?? [];
  const payouts = payoutsQuery.data ?? [];
  const statsCards = useMemo(
    () => [
      { label: "Total sales", value: formatUGX(finance?.gross ?? stats?.totalSales ?? 0), sub: "Paid orders", accent: true },
      { label: "Tickets sold", value: String(stats?.ticketsSold ?? 0), sub: "All events" },
      { label: "Active events", value: String(stats?.totalEvents ?? events.length), sub: "Published catalog" },
      { label: "Followers", value: String(profileQuery.data?.followerCount ?? 0), sub: "Organizer profile" },
    ],
    [events.length, finance?.gross, profileQuery.data?.followerCount, stats],
  );

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please upload an image file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setAvatarError("Avatar image must be less than 3MB.");
      return;
    }

    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user?.id ?? "organizer"}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("organizer-avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("organizer-avatars").getPublicUrl(path);
      setProfileForm((current) => ({ ...current, avatarUrl: data.publicUrl }));
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Avatar upload failed.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    saveProfileMutation.mutate();
  };

  const submitPayout = (event: FormEvent) => {
    event.preventDefault();
    requestPayoutMutation.mutate();
  };

  const navItems: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: "Overview", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "events", label: "My Events", icon: <Calendar className="h-4 w-4" /> },
    { id: "sales", label: "Sales", icon: <Ticket className="h-4 w-4" /> },
    { id: "attendees", label: "Attendees", icon: <Users className="h-4 w-4" /> },
    { id: "payouts", label: "Payouts", icon: <Banknote className="h-4 w-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 font-bold text-primary">
              <LayoutDashboard className="h-5 w-5" /> Organizer
            </div>
            <Separator className="my-2" />
            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    tab === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </nav>
          </Card>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-6 flex gap-2 overflow-x-auto md:hidden">
            {navItems.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={tab === item.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(item.id)}
                className="shrink-0"
              >
                {item.icon} {item.label}
              </Button>
            ))}
          </div>

          {!accessToken && (
            <Alert className="mb-6">
              <AlertTitle>Session still loading</AlertTitle>
              <AlertDescription>Organizer-only data will appear once your Supabase session is available.</AlertDescription>
            </Alert>
          )}

          {tab === "overview" && (
            <div className="space-y-6">
              <Header title="Dashboard Overview" actionLabel="Create Event" actionTo="/dashboard/form" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statsCards.map((card) => (
                  <Card key={card.label} className={`p-5 ${card.accent ? "bg-primary text-primary-foreground" : ""}`}>
                    <div className="text-sm opacity-80">{card.label}</div>
                    <div className="mt-1 text-2xl font-bold">{card.value}</div>
                    <div className="mt-1 text-xs opacity-70">{card.sub}</div>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <Card className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Payout Breakdown</div>
                      <div className="mt-1 text-2xl font-bold">{formatUGX(finance?.available ?? 0)}</div>
                      <div className="text-xs text-muted-foreground">Available after requested payouts</div>
                    </div>
                    {financeQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                    <Metric label="Gross" value={formatUGX(finance?.gross ?? 0)} />
                    <Metric label="Fees" value={formatUGX(finance?.fees ?? 0)} />
                    <Metric label="Requested" value={formatUGX(finance?.requested ?? 0)} />
                  </div>
                </Card>

                <Card className="divide-y">
                  {events.slice(0, 3).map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                  {events.length === 0 && <EmptyState label="No events yet. Create your first event to start selling." />}
                </Card>
              </div>
            </div>
          )}

          {tab === "events" && (
            <div className="space-y-6">
              <Header title="My Events" actionLabel="Create Event" actionTo="/dashboard/form" />
              <Card className="divide-y">
                {events.map((event) => (
                  <EventRow key={event.id} event={event} editable />
                ))}
                {events.length === 0 && <EmptyState label="No events found." />}
              </Card>
            </div>
          )}

          {tab === "sales" && (
            <Section title="Ticket Sales" loading={salesQuery.isLoading}>
              <Card className="divide-y">
                {sales.map((sale) => (
                  <div key={sale.orderId} className="grid gap-3 p-4 text-sm md:grid-cols-[1.4fr_1fr_0.7fr_0.7fr]">
                    <div>
                      <div className="font-semibold">{sale.eventTitle}</div>
                      <div className="text-xs text-muted-foreground">{sale.tierName} x {sale.quantity}</div>
                    </div>
                    <div>
                      <div>{sale.buyerName || "Guest"}</div>
                      <div className="text-xs text-muted-foreground">{sale.buyerEmail}</div>
                    </div>
                    <div>{formatUGX(sale.total)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(sale.purchasedAt).toLocaleDateString("en-UG")}</div>
                  </div>
                ))}
                {sales.length === 0 && <EmptyState label="No paid sales yet." />}
              </Card>
            </Section>
          )}

          {tab === "attendees" && (
            <Section title="Attendees" loading={attendeesQuery.isLoading}>
              <Card className="divide-y">
                {attendees.map((attendee) => (
                  <div key={attendee.ticketId} className="grid gap-3 p-4 text-sm md:grid-cols-[1.3fr_1fr_0.7fr_1fr]">
                    <div>
                      <div className="font-semibold">{attendee.holderName || "Ticket holder"}</div>
                      <div className="text-xs text-muted-foreground">{attendee.eventTitle}</div>
                    </div>
                    <div>{attendee.tierName}</div>
                    <Badge variant={attendee.status === "used" ? "default" : "secondary"}>{attendee.status}</Badge>
                    <div className="text-xs text-muted-foreground">
                      {attendee.usedAt ? `Checked in ${new Date(attendee.usedAt).toLocaleString("en-UG")}` : attendee.orderId}
                    </div>
                  </div>
                ))}
                {attendees.length === 0 && <EmptyState label="No issued tickets yet." />}
              </Card>
            </Section>
          )}

          {tab === "payouts" && (
            <div className="space-y-6">
              <Section title="Payouts" loading={payoutsQuery.isLoading || financeQuery.isLoading}>
                <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                  <Card className="p-5">
                    <div className="text-sm text-muted-foreground">Available balance</div>
                    <div className="mt-1 text-2xl font-bold">{formatUGX(finance?.available ?? 0)}</div>
                    <form onSubmit={submitPayout} className="mt-5 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="payout-amount">Amount</Label>
                        <Input id="payout-amount" inputMode="numeric" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payout-note">Note</Label>
                        <Textarea id="payout-note" value={payoutNote} onChange={(e) => setPayoutNote(e.target.value)} />
                      </div>
                      {requestPayoutMutation.error && <p className="text-sm text-destructive">{requestPayoutMutation.error.message}</p>}
                      <Button
                        type="submit"
                        disabled={!accessToken || requestPayoutMutation.isPending || Number(payoutAmount) <= 0}
                        className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
                      >
                        {requestPayoutMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Request Payout
                      </Button>
                    </form>
                  </Card>
                  <Card className="divide-y">
                    {payouts.map((payout) => (
                      <div key={payout.id} className="grid gap-3 p-4 text-sm md:grid-cols-[0.8fr_0.7fr_1fr_0.8fr]">
                        <div className="font-semibold">{formatUGX(payout.amount)}</div>
                        <Badge variant={payout.status === "rejected" ? "destructive" : "secondary"}>{payout.status}</Badge>
                        <div className="text-muted-foreground">{payout.paymentMethod} - {payout.paymentAccount}</div>
                        <div className="text-xs text-muted-foreground">{new Date(payout.requestedAt).toLocaleDateString("en-UG")}</div>
                      </div>
                    ))}
                    {payouts.length === 0 && <EmptyState label="No payout requests yet." />}
                  </Card>
                </div>
              </Section>
            </div>
          )}

          {tab === "settings" && (
            <Section title="Organizer Settings" loading={profileQuery.isLoading}>
              <Card className="p-5">
                <form onSubmit={submitProfile} className="space-y-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <img
                      src={profileForm.avatarUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=300&auto=format&fit=crop"}
                      alt=""
                      className="h-20 w-20 rounded-full object-cover ring-1 ring-border"
                    />
                    <div>
                      <Label htmlFor="avatar-upload" className="mb-2 block">Avatar</Label>
                      <Input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                      {avatarError && <p className="mt-1 text-xs text-destructive">{avatarError}</p>}
                    </div>
                    {uploadingAvatar && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Display name" value={profileForm.displayName} onChange={(value) => setProfileForm((p) => ({ ...p, displayName: value }))} />
                    <Field label="Phone" value={profileForm.phone} onChange={(value) => setProfileForm((p) => ({ ...p, phone: value }))} />
                    <Field label="Website" value={profileForm.website} onChange={(value) => setProfileForm((p) => ({ ...p, website: value }))} />
                    <Field label="Payout method" value={profileForm.payoutMethod} onChange={(value) => setProfileForm((p) => ({ ...p, payoutMethod: value }))} />
                    <Field label="Payout account" value={profileForm.payoutAccount} onChange={(value) => setProfileForm((p) => ({ ...p, payoutAccount: value }))} />
                    <Field label="Avatar URL" value={profileForm.avatarUrl} onChange={(value) => setProfileForm((p) => ({ ...p, avatarUrl: value }))} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organizer-bio">Bio</Label>
                    <Textarea
                      id="organizer-bio"
                      maxLength={600}
                      value={profileForm.bio}
                      onChange={(event) => setProfileForm((p) => ({ ...p, bio: event.target.value }))}
                    />
                  </div>

                  {saveProfileMutation.error && <p className="text-sm text-destructive">{saveProfileMutation.error.message}</p>}
                  {profileSaved && (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <CheckCircle2 className="h-4 w-4" /> Settings saved
                    </div>
                  )}
                  <Button type="submit" disabled={!accessToken || saveProfileMutation.isPending} className="bg-cta text-cta-foreground hover:bg-cta/90">
                    {saveProfileMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save Settings
                  </Button>
                </form>
              </Card>
            </Section>
          )}
        </main>
      </div>
    </div>
  );
}

function Header({ title, actionLabel, actionTo }: { title: string; actionLabel: string; actionTo: "/dashboard/form" }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Button asChild className="bg-cta text-cta-foreground hover:bg-cta/90">
        <Link to={actionTo}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

function Section({ title, loading, children }: { title: string; loading?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function EventRow({ event, editable = false }: { event: { id: string; title: string; image: string; city: string; category: string; date: string; venue: string }; editable?: boolean }) {
  return (
    <div className="flex items-center gap-4 p-4">
      <img src={event.image} alt="" className="h-14 w-14 rounded-md object-cover" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{event.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {new Date(event.date).toLocaleDateString("en-UG")} - {event.venue || event.city} - {event.category}
        </div>
      </div>
      <Button asChild variant="ghost" size="sm">
        <Link to="/events/$eventId" params={{ eventId: event.id }}><Eye className="h-4 w-4" /> View</Link>
      </Button>
      {editable && (
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/form" search={{ eventId: event.id }}><Edit3 className="h-4 w-4" /> Edit</Link>
        </Button>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="p-6 text-center text-sm text-muted-foreground">{label}</div>;
}
