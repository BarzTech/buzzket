import { createFileRoute } from "@tanstack/react-router";
import {
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  LayoutDashboard,
  Banknote,
  Users,
  Tag,
  Settings2,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Clock,
  BadgeCheck,
  TrendingUp,
  AlertTriangle,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  CalendarCheck,
  Wallet,
  PiggyBank,
} from "lucide-react";

import { formatUGX } from "@/lib/format";
import {
  getAdminPayouts,
  saveAdminPayouts,
  updateAdminPayout,
  getAdminOrganizers,
  getAdminOrders,
  getAdminEvents,
  deleteAdminEvent,
  computeAdminStats,
  updateOrganizerStatus,
  getPlatformSettings,
  updatePlatformSettings,
  type Payout,
  type PayoutStatus,
  type OrganizerRow,
  type PlatformOrder,
  type AdminStats,
  type AdminEvent,
  type PlatformSettings,
} from "@/lib/data/admin";
import {
  getCommissionSettings,
  saveCommissionSettings,
  type CommissionSettings,
} from "@/lib/admin/commission-store";
import {
  createPromoCode,
  deletePromoCode,
  getPromoEvents,
  getPromoCodes,
  updatePromoCode,
  type PromoCode,
  type PromoEvent,
} from "@/lib/admin/promo-store";
import { requireRoleOrRedirect } from "@/lib/auth/guard";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ location }) => requireRoleOrRedirect("admin", location.href),
  component: AdminPage,
});

// ─── Shared helpers ────────────────────────────────────────────────────────────

const STATUS_META: Record<
  PayoutStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  approved: {
    label: "Approved",
    color: "text-sky-400 bg-sky-400/10 border-sky-400/30",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  rejected: {
    label: "Rejected",
    color: "text-red-400 bg-red-400/10 border-red-400/30",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  paid: {
    label: "Paid",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    icon: <BadgeCheck className="h-3.5 w-3.5" />,
  },
};

function StatusBadge({ status }: { status: PayoutStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.color}`}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-6 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
        accent
          ? "border-violet-500/40 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10"
          : "border-white/10 bg-white/5 hover:bg-white/8"
      }`}
    >
      <div className="mb-3 inline-flex rounded-xl bg-white/10 p-2.5">{icon}</div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── Tab types ─────────────────────────────────────────────────────────────────

type Tab = "overview" | "events" | "payouts" | "organizers" | "orders" | "promos" | "settings";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "events", label: "Events", icon: <CalendarCheck className="h-4 w-4" /> },
  { id: "payouts", label: "Payouts", icon: <Banknote className="h-4 w-4" /> },
  { id: "organizers", label: "Organizers", icon: <Users className="h-4 w-4" /> },
  { id: "orders", label: "Orders", icon: <ShoppingBag className="h-4 w-4" /> },
  { id: "promos", label: "Promo Codes", icon: <Tag className="h-4 w-4" /> },
  { id: "settings", label: "Settings", icon: <Settings2 className="h-4 w-4" /> },
];

// ─── Section: Overview ─────────────────────────────────────────────────────────

function OverviewSection({
  stats,
  payouts,
  pendingOrganizersCount,
}: {
  stats: AdminStats;
  payouts: Payout[];
  pendingOrganizersCount: number;
}) {
  const pending = payouts.filter((p) => p.status === "pending");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-1">Platform Overview</h2>
        <p className="text-sm text-muted-foreground">Live snapshot of platform financial health.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent
          label="Gross Revenue"
          value={formatUGX(stats.totalGrossRevenue)}
          sub="All confirmed orders"
          icon={<TrendingUp className="h-5 w-5 text-violet-400" />}
        />
        <StatCard
          label="Platform Earnings"
          value={formatUGX(stats.totalPlatformEarnings)}
          sub="Fees collected"
          icon={<PiggyBank className="h-5 w-5 text-emerald-400" />}
        />
        <StatCard
          label="Organizer Payouts"
          value={formatUGX(stats.totalOrganizerPayouts)}
          sub="Net owed to organisers"
          icon={<Wallet className="h-5 w-5 text-sky-400" />}
        />
        <StatCard
          label="Pending Payouts"
          value={formatUGX(stats.pendingPayoutsAmount)}
          sub={`${pending.length} request${pending.length !== 1 ? "s" : ""} awaiting review`}
          icon={<Clock className="h-5 w-5 text-yellow-400" />}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          <div className="text-3xl font-bold">{stats.totalTicketsSold}</div>
          <div className="mt-1 text-xs text-muted-foreground">Tickets Sold</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          <div className="text-3xl font-bold">{stats.totalOrders}</div>
          <div className="mt-1 text-xs text-muted-foreground">Total Orders</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          <div className="text-3xl font-bold">{stats.totalOrganizers}</div>
          <div className="mt-1 text-xs text-muted-foreground">Organisers</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          <div className="text-3xl font-bold">{stats.totalEvents}</div>
          <div className="mt-1 text-xs text-muted-foreground">Events Listed</div>
        </div>
      </div>

      {pendingOrganizersCount > 0 && (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-5">
          <div className="flex items-center gap-2 text-yellow-400 font-semibold mb-1">
            <AlertTriangle className="h-4 w-4" />
            {pendingOrganizersCount} Organiser{pendingOrganizersCount !== 1 ? "s" : ""} Awaiting Approval
          </div>
          <p className="text-sm text-muted-foreground">
            Review pending organiser accounts in the Organisers tab before they can publish events.
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-5">
          <div className="flex items-center gap-2 text-yellow-400 font-semibold mb-3">
            <AlertTriangle className="h-4 w-4" />
            {pending.length} Payout{pending.length !== 1 ? "s" : ""} Awaiting Approval
          </div>
          <div className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5"
              >
                <div>
                  <div className="text-sm font-medium">{p.organizerName}</div>
                  <div className="text-xs text-muted-foreground">{p.eventTitle}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-yellow-300">{formatUGX(p.netAmount)}</div>
                  <div className="text-xs text-muted-foreground">{p.paymentMethod}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Payouts ──────────────────────────────────────────────────────────

function PayoutsSection({
  payouts,
  onUpdateStatus,
}: {
  payouts: Payout[];
  onUpdateStatus: (id: string, status: PayoutStatus) => void;
}) {
  const [filter, setFilter] = useState<PayoutStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter === "all" ? payouts : payouts.filter((p) => p.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold mb-0.5">Payout Requests</h2>
          <p className="text-sm text-muted-foreground">Approve or reject organiser payout requests.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "pending", "approved", "paid", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                filter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-white/10 text-muted-foreground hover:border-white/30"
              }`}
            >
              {s === "all" ? "All" : STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-muted-foreground text-sm">
            No payouts match this filter.
          </div>
        )}
        {filtered.map((p) => {
          const expanded = expandedId === p.id;
          return (
            <div
              key={p.id}
              className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden transition-all hover:bg-white/8"
            >
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                onClick={() => setExpandedId(expanded ? null : p.id)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{p.organizerName}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.eventTitle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-bold">{formatUGX(p.netAmount)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(p.requestedAt).toLocaleDateString()}</div>
                  </div>
                  <StatusBadge status={p.status} />
                  {expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {expanded && (
                <div className="border-t border-white/10 px-5 py-4 space-y-4 bg-white/3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      ["Gross Amount", formatUGX(p.grossAmount)],
                      ["Platform Fee", formatUGX(p.platformFee)],
                      ["Net Payout", formatUGX(p.netAmount)],
                      ["Tickets Sold", p.ticketsSold.toString()],
                      ["Payment Method", p.paymentMethod],
                      ["Account / Number", p.paymentAccount],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div className="text-xs text-muted-foreground mb-0.5">{k}</div>
                        <div className="text-sm font-medium">{v}</div>
                      </div>
                    ))}
                  </div>

                  {p.status === "pending" && (
                    <div className="flex gap-3 pt-1">
                      <button
                        id={`approve-payout-${p.id}`}
                        onClick={() => onUpdateStatus(p.id, "approved")}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </button>
                      <button
                        id={`reject-payout-${p.id}`}
                        onClick={() => onUpdateStatus(p.id, "rejected")}
                        className="flex items-center gap-1.5 rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/30 transition-colors"
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </button>
                    </div>
                  )}
                  {p.status === "approved" && (
                    <div className="flex gap-3 pt-1">
                      <button
                        id={`mark-paid-payout-${p.id}`}
                        onClick={() => onUpdateStatus(p.id, "paid")}
                        className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 transition-colors"
                      >
                        <BadgeCheck className="h-4 w-4" /> Mark as Paid
                      </button>
                    </div>
                  )}
                  {(p.status === "paid" || p.status === "rejected") && (
                    <div className="text-xs text-muted-foreground">
                      Resolved {p.resolvedAt ? new Date(p.resolvedAt).toLocaleString() : "—"}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section: Organizers ───────────────────────────────────────────────────────

function OrganizersSection({ organizers, onUpdateStatus }: { organizers: OrganizerRow[], onUpdateStatus: (id: string, status: "pending" | "approved" | "rejected") => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-0.5">Organisers</h2>
        <p className="text-sm text-muted-foreground">Lifetime earnings and pending payouts per organiser.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Organiser</th>
              <th className="px-4 py-3 text-right">Events</th>
              <th className="px-4 py-3 text-right">Tickets</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">Platform Fee</th>
              <th className="px-4 py-3 text-right">Net Payout</th>
              <th className="px-4 py-3 text-right">Pending</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {organizers.map((o, i) => (
              <tr
                key={o.id}
                className={`border-b border-white/5 transition-colors hover:bg-white/5 ${
                  i % 2 === 0 ? "bg-transparent" : "bg-white/2"
                }`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{o.name}</div>
                  <div className="text-xs text-muted-foreground">{o.email}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{o.totalEvents}</td>
                <td className="px-4 py-3 text-right tabular-nums">{o.totalTicketsSold}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{formatUGX(o.totalGross)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-red-400">{formatUGX(o.totalFees)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-400 font-semibold">
                  {formatUGX(o.totalNet)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {o.pendingPayout > 0 ? (
                    <span className="text-yellow-400 font-semibold">{formatUGX(o.pendingPayout)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      o.approvalStatus === "approved"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : o.approvalStatus === "rejected"
                        ? "border-red-500/30 bg-red-500/10 text-red-400"
                        : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                    }`}
                  >
                    {o.approvalStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {o.approvalStatus === "pending" && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onUpdateStatus(o.id, "approved")}
                        className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onUpdateStatus(o.id, "rejected")}
                        className="rounded-lg bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/30"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {o.approvalStatus === "rejected" && (
                    <button
                      onClick={() => onUpdateStatus(o.id, "approved")}
                      className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30"
                    >
                      Approve
                    </button>
                  )}
                  {o.approvalStatus === "approved" && (
                    <button
                      onClick={() => onUpdateStatus(o.id, "rejected")}
                      className="rounded-lg bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/30"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section: Orders ───────────────────────────────────────────────────────────

function OrdersSection({ orders }: { orders: PlatformOrder[] }) {
  const ORDER_STATUS_COLOR: Record<string, string> = {
    confirmed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    refunded: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    cancelled: "text-red-400 bg-red-400/10 border-red-400/30",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-0.5">Platform Orders</h2>
        <p className="text-sm text-muted-foreground">All ticket purchases across the platform.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Order</th>
              <th className="px-4 py-3 text-left">Event / Organiser</th>
              <th className="px-4 py-3 text-right">Tier</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">Platform Fee</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr
                key={o.id}
                className={`border-b border-white/5 transition-colors hover:bg-white/5 ${
                  i % 2 === 0 ? "bg-transparent" : "bg-white/2"
                }`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-xs font-mono text-muted-foreground">{o.id}</div>
                  <div className="text-xs text-muted-foreground">{o.buyerName}</div>
                  <div className="text-xs text-muted-foreground/60">{new Date(o.purchasedAt).toLocaleDateString()}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{o.eventTitle}</div>
                  <div className="text-xs text-muted-foreground">{o.organizerName}</div>
                </td>
                <td className="px-4 py-3 text-right">{o.ticketTier}</td>
                <td className="px-4 py-3 text-right tabular-nums">{o.qty}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{formatUGX(o.totalGross)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-violet-400">{formatUGX(o.platformFee)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-400 font-semibold">
                  {formatUGX(o.organizerNet)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLOR[o.status]}`}
                  >
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section: Promo Codes ─────────────────────────────────────────────────────

function PromoCodesSection() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [events, setEvents] = useState<PromoEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    eventId: "",
    code: "",
    type: "percent" as "percent" | "flat",
    value: "",
    maxUses: "",
    expiresAt: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPromoCodes(), getPromoEvents()])
      .then(([promoCodes, promoEvents]) => {
        setCodes(promoCodes);
        setEvents(promoEvents);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load promo codes."))
      .finally(() => setLoading(false));
  }, []);

  const refreshCodes = async () => {
    setCodes(await getPromoCodes());
  };

  const toggleActive = async (id: string) => {
    const code = codes.find((c) => c.id === id);
    if (!code) return;
    await updatePromoCode(id, { active: !code.active });
    await refreshCodes();
  };

  const deleteCode = async (id: string) => {
    await deletePromoCode(id);
    await refreshCodes();
  };

  const handleCreate = async () => {
    setError("");
    if (!form.eventId) return setError("Select an event for this promo code.");
    if (!form.code.trim()) return setError("Code is required.");
    if (!form.value || isNaN(Number(form.value))) return setError("Value must be a number.");
    if (form.type === "percent" && (Number(form.value) <= 0 || Number(form.value) > 100))
      return setError("Percentage must be 1–100.");

    const exists = codes.some((c) =>
      c.eventId === form.eventId && c.code.toLowerCase() === form.code.trim().toLowerCase()
    );
    if (exists) return setError("This event already has a promo code with that name.");

    await createPromoCode({
      eventId: form.eventId,
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      expiresAt: form.expiresAt || null,
    });

    await refreshCodes();
    setForm({ eventId: "", code: "", type: "percent", value: "", maxUses: "", expiresAt: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold mb-0.5">Promo Codes</h2>
          <p className="text-sm text-muted-foreground">Create event-specific discount codes for buyers.</p>
        </div>
        <button
          id="create-promo-code-btn"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Code
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-violet-500/40 bg-violet-500/5 p-5 space-y-4">
          <div className="font-semibold text-sm text-violet-300">Create Promo Code</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Event *</label>
              <select
                id="promo-event-select"
                value={form.eventId}
                onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="">Select event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Code *</label>
              <input
                id="promo-code-input"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. SUMMER20"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:border-violet-500 uppercase font-mono tracking-wider"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Discount Type</label>
              <select
                id="promo-type-select"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "percent" | "flat" }))}
                className="w-full rounded-xl border border-white/10 bg-background px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Amount (UGX)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                {form.type === "percent" ? "Discount %" : "Discount (UGX)"} *
              </label>
              <input
                id="promo-value-input"
                type="number"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder={form.type === "percent" ? "10" : "5000"}
                min="1"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Max Uses (blank = unlimited)</label>
              <input
                id="promo-maxuses-input"
                type="number"
                value={form.maxUses}
                onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                placeholder="100"
                min="1"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Expiry Date (optional)</label>
              <input
                id="promo-expires-input"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
          <div className="flex gap-3">
            <button
              id="save-promo-btn"
              onClick={handleCreate}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Create Code
            </button>
            <button
              onClick={() => { setShowForm(false); setError(""); }}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-muted-foreground text-sm">
            Loading promo codes...
          </div>
        )}
        {!loading && codes.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-muted-foreground text-sm">
            No promo codes yet. Create one above.
          </div>
        )}
        {codes.map((c) => {
          const exhausted = c.maxUses !== null && c.usedCount >= c.maxUses;
          const expired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false;
          const effective = c.active && !exhausted && !expired;

          return (
            <div
              key={c.id}
              className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition-all ${
                effective
                  ? "border-white/10 bg-white/5"
                  : "border-white/5 bg-white/2 opacity-60"
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="font-mono font-bold tracking-widest text-sm text-violet-300 bg-violet-500/10 border border-violet-500/30 rounded-lg px-2.5 py-1">
                  {c.code}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {c.type === "percent" ? `${c.value}% off` : `${formatUGX(c.value)} off`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.eventTitle} ·{" "}
                    {c.usedCount} used
                    {c.maxUses !== null ? ` / ${c.maxUses} max` : " · unlimited"}
                    {c.expiresAt ? ` · expires ${c.expiresAt}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {(exhausted || expired) && (
                  <span className="text-xs text-muted-foreground">{exhausted ? "Exhausted" : "Expired"}</span>
                )}
                <button
                  id={`toggle-promo-${c.id}`}
                  onClick={() => toggleActive(c.id)}
                  title={c.active ? "Disable" : "Enable"}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {c.active ? (
                    <ToggleRight className="h-6 w-6 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-6 w-6" />
                  )}
                </button>
                <button
                  id={`delete-promo-${c.id}`}
                  onClick={() => deleteCode(c.id)}
                  title="Delete"
                  className="text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section: Events ───────────────────────────────────────────────────────────

function EventsSection({ events, onDeleteEvent }: { events: AdminEvent[], onDeleteEvent: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-0.5">Platform Events</h2>
        <p className="text-sm text-muted-foreground">Manage all events listed on the platform.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-left">Organiser</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Created At</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr
                key={e.id}
                className={`border-b border-white/5 transition-colors hover:bg-white/5 ${
                  i % 2 === 0 ? "bg-transparent" : "bg-white/2"
                }`}
              >
                <td className="px-4 py-3 font-medium">{e.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.organizerName}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(e.date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
                        onDeleteEvent(e.id);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section: Settings ─────────────────────────────────────────────────────────

function SettingsSection({
  initialSettings,
  onSettingsUpdated,
}: {
  initialSettings: PlatformSettings | null;
  onSettingsUpdated: (s: PlatformSettings) => void;
}) {
  const [settings, setSettings] = useState<CommissionSettings>({
    percent: 0.05,
    flatUGX: 500,
  });
  const [saved, setSaved] = useState(false);
  const [percentInput, setPercentInput] = useState("");
  const [flatInput, setFlatInput] = useState("");
  
  const [platSettings, setPlatSettings] = useState<PlatformSettings | null>(initialSettings);
  const [platSaved, setPlatSaved] = useState(false);
  const [platSaving, setPlatSaving] = useState(false);

  useEffect(() => {
    setPlatSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    const s = getCommissionSettings();
    setSettings(s);
    setPercentInput((s.percent * 100).toFixed(2));
    setFlatInput(s.flatUGX.toString());
  }, []);

  const handleSave = () => {
    const percent = parseFloat(percentInput) / 100;
    const flatUGX = parseInt(flatInput, 10);
    if (isNaN(percent) || percent < 0 || percent > 1) return;
    if (isNaN(flatUGX) || flatUGX < 0) return;
    const updated = { percent, flatUGX };
    setSettings(updated);
    saveCommissionSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    const defaults = { percent: 0.05, flatUGX: 500 };
    setSettings(defaults);
    setPercentInput("5.00");
    setFlatInput("500");
    saveCommissionSettings(defaults);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Preview for a sample ticket
  const samplePrice = 100_000;
  const commissionAmount = Math.round(samplePrice * settings.percent) + settings.flatUGX;
  const organizerNet = samplePrice - commissionAmount;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold mb-0.5">Commission Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure how the platform collects fees from every ticket sold. Changes take effect on the next checkout.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-6">
        <div>
          <label
            htmlFor="commission-percent"
            className="block text-sm font-medium mb-1"
          >
            Platform Percentage Fee
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            A percentage of gross ticket revenue charged per order.
          </p>
          <div className="flex items-center gap-2">
            <input
              id="commission-percent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={percentInput}
              onChange={(e) => {
                setPercentInput(e.target.value);
                setSettings((s) => ({ ...s, percent: parseFloat(e.target.value) / 100 || 0 }));
              }}
              className="w-36 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>

        <div>
          <label
            htmlFor="commission-flat"
            className="block text-sm font-medium mb-1"
          >
            Flat Fee per Ticket (UGX)
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            A fixed amount charged per individual ticket sold (on top of the percentage).
          </p>
          <div className="flex items-center gap-2">
            <input
              id="commission-flat"
              type="number"
              step="100"
              min="0"
              value={flatInput}
              onChange={(e) => {
                setFlatInput(e.target.value);
                setSettings((s) => ({ ...s, flatUGX: parseInt(e.target.value, 10) || 0 }));
              }}
              className="w-36 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
            />
            <span className="text-sm text-muted-foreground">UGX</span>
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Preview — {formatUGX(samplePrice)} ticket
          </div>
          {[
            ["Ticket Price", formatUGX(samplePrice)],
            [
              `Platform Fee (${(settings.percent * 100).toFixed(2)}% + ${formatUGX(settings.flatUGX)}/ticket)`,
              formatUGX(commissionAmount),
            ],
            ["Organiser Receives", formatUGX(organizerNet)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium tabular-nums">{value}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            id="save-commission-btn"
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <CalendarCheck className="h-4 w-4" />
            Save Settings
          </button>
          <button
            id="reset-commission-btn"
            onClick={handleReset}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </button>
          {saved && (
            <span className="text-xs text-emerald-400 font-medium animate-fade-in">
              ✓ Saved successfully
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Additional Platform Settings</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Manage global platform behaviour and notifications.</p>
          </div>
        </div>
        
        {platSettings ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
              <div>
                <label className="font-medium text-sm">Maintenance Mode</label>
                <p className="text-xs text-muted-foreground mt-0.5">When active, the public site is disabled for all users except admins.</p>
              </div>
              <button
                onClick={() => setPlatSettings(s => s ? { ...s, maintenanceMode: !s.maintenanceMode } : s)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {platSettings.maintenanceMode ? (
                  <ToggleRight className="h-8 w-8 text-red-500" />
                ) : (
                  <ToggleLeft className="h-8 w-8" />
                )}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Global Refund Policy</label>
              <p className="text-xs text-muted-foreground mb-3">Displayed to buyers during checkout and on their tickets.</p>
              <textarea
                value={platSettings.refundPolicy}
                onChange={(e) => setPlatSettings(s => s ? { ...s, refundPolicy: e.target.value } : s)}
                placeholder="e.g. All sales are final. No refunds unless the event is cancelled."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:border-violet-500 min-h-[80px] resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Support SLA (Hours)</label>
              <p className="text-xs text-muted-foreground mb-3">The expected maximum response time for organiser support queries.</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={platSettings.slaHours}
                  onChange={(e) => setPlatSettings(s => s ? { ...s, slaHours: parseInt(e.target.value) || 24 } : s)}
                  className="w-24 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-white/10">
              <h4 className="font-medium text-sm">Notification Templates</h4>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Email Subject</label>
                <input
                  type="text"
                  value={platSettings.emailTemplateSubject}
                  onChange={(e) => setPlatSettings(s => s ? { ...s, emailTemplateSubject: e.target.value } : s)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Email Body</label>
                <textarea
                  value={platSettings.emailTemplateBody}
                  onChange={(e) => setPlatSettings(s => s ? { ...s, emailTemplateBody: e.target.value } : s)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:border-violet-500 min-h-[100px] resize-y"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">SMS Notification</label>
                <textarea
                  value={platSettings.smsTemplate}
                  onChange={(e) => setPlatSettings(s => s ? { ...s, smsTemplate: e.target.value } : s)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:border-violet-500 min-h-[60px] resize-y"
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">Available variables: {'{{eventName}}'}, {'{{userName}}'}, {'{{ticketTier}}'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <button
                onClick={async () => {
                  if (!platSettings) return;
                  setPlatSaving(true);
                  try {
                    const supabase = getSupabaseBrowserClient();
                    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
                    const accessToken = data.session?.access_token;
                    if (accessToken) {
                      await updatePlatformSettings({ data: { accessToken, settings: platSettings } });
                      onSettingsUpdated(platSettings);
                      setPlatSaved(true);
                      setTimeout(() => setPlatSaved(false), 3000);
                    }
                  } catch (e) {
                    alert("Failed to save settings");
                  } finally {
                    setPlatSaving(false);
                  }
                }}
                disabled={platSaving}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {platSaving ? "Saving..." : "Save Platform Settings"}
              </button>
              {platSaved && (
                <span className="text-xs text-emerald-400 font-medium animate-fade-in">
                  ✓ Saved successfully
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Loading settings...</div>
        )}
      </div>
    </div>
  );
}

// ─── Main AdminPage ────────────────────────────────────────────────────────────

function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([]);
  const [orders, setOrders] = useState<PlatformOrder[]>([]);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Admin session is missing. Please sign in again.");

      return Promise.all([
        getAdminPayouts({ data: { accessToken } }),
        getAdminOrganizers({ data: { accessToken } }),
        getAdminOrders({ data: { accessToken } }),
        getAdminEvents({ data: { accessToken } }),
        getPlatformSettings({ data: { accessToken } }),
      ]);
    };

    load()
      .then(([payoutsRes, organizersRes, ordersRes, eventsRes, settingsRes]) => {
        let mergedPayouts = payoutsRes;
        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem("bzk-payout-status");
          if (raw) {
            try {
              const statusMap = JSON.parse(raw) as Record<string, { status: PayoutStatus; resolvedAt: string | null }>;
              mergedPayouts = payoutsRes.map((p) => {
                const saved = statusMap[p.id];
                if (saved) {
                  return { ...p, status: saved.status, resolvedAt: saved.resolvedAt };
                }
                return p;
              });
            } catch {}
          }
        }
        setPayouts(mergedPayouts);
        setOrganizers(organizersRes);
        setOrders(ordersRes);
        setAdminEvents(eventsRes);
        setPlatformSettings(settingsRes);
      })
      .catch((err) => {
        console.error("Failed to load admin data", err);
        setLoadError(err instanceof Error ? err.message : "Failed to load admin data.");
      })
      .finally(() => setLoading(false));
  }, []);

  const stats: AdminStats = computeAdminStats(payouts, orders);

  const handleUpdatePayoutStatus = useCallback(
    async (id: string, status: PayoutStatus) => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error("Admin session missing.");

        await updateAdminPayout({ data: { accessToken, payoutId: id, status } });
        setPayouts((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, status, resolvedAt: status !== "pending" ? new Date().toISOString() : null }
              : p,
          )
        );
      } catch (err) {
        console.error("Failed to update payout", err);
        alert("Failed to update payout status.");
      }
    },
    [],
  );

  const handleOrganizerStatusUpdate = useCallback(
    async (id: string, status: "pending" | "approved" | "rejected") => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error("Admin session missing.");

        await updateOrganizerStatus({ data: { accessToken, organizerId: id, status } });
        setOrganizers((prev) =>
          prev.map((o) => (o.id === id ? { ...o, approvalStatus: status } : o))
        );
      } catch (err) {
        console.error("Failed to update organizer status", err);
        alert("Failed to update organizer status.");
      }
    },
    [],
  );

  const handleDeleteEvent = useCallback(
    async (id: string) => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error("Admin session missing.");

        await deleteAdminEvent({ data: { accessToken, eventId: id } });
        setAdminEvents((prev) => prev.filter((e) => e.id !== id));
      } catch (err) {
        console.error("Failed to delete event", err);
        alert("Failed to delete event.");
      }
    },
    [],
  );

  const pendingCount = payouts.filter((p) => p.status === "pending").length;
  const pendingOrganizersCount = organizers.filter((o) => o.approvalStatus === "pending").length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground text-sm">
        Loading admin console...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div>
          <h1 className="text-xl font-semibold">Admin console locked</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{loadError}</p>
          <a href="/admin/login" className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Sign in again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin header */}
      <div className="border-b border-white/10 bg-white/3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Settings2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-none">Buzzket Admin</div>
              <div className="text-xs text-muted-foreground mt-0.5">Platform Management Console</div>
            </div>
          </div>
          <a
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to site
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <aside className="lg:w-56 shrink-0">
            <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible pb-2 lg:pb-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  id={`admin-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all whitespace-nowrap relative ${
                    activeTab === tab.id
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.id === "payouts" && pendingCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-black px-1">
                      {pendingCount}
                    </span>
                  )}
                  {tab.id === "organizers" && pendingOrganizersCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-black px-1">
                      {pendingOrganizersCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {activeTab === "overview" && (
              <OverviewSection
                stats={stats}
                payouts={payouts}
                pendingOrganizersCount={pendingOrganizersCount}
              />
            )}
            {activeTab === "events" && (
              <EventsSection events={adminEvents} onDeleteEvent={handleDeleteEvent} />
            )}
            {activeTab === "payouts" && (
              <PayoutsSection payouts={payouts} onUpdateStatus={handleUpdatePayoutStatus} />
            )}
            {activeTab === "organizers" && <OrganizersSection organizers={organizers} onUpdateStatus={handleOrganizerStatusUpdate} />}
            {activeTab === "orders" && <OrdersSection orders={orders} />}
            {activeTab === "promos" && <PromoCodesSection />}
            {activeTab === "settings" && <SettingsSection initialSettings={platformSettings} onSettingsUpdated={setPlatformSettings} />}
          </main>
        </div>
      </div>
    </div>
  );
}
