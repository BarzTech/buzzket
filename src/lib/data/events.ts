import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import type { Event, TicketTier } from "../format";
import { SEED_EVENTS_WITH_TIERS, findSeedEvent } from "../seed";
import { getSupabaseAdmin } from "../supabase/server";

// --- DB row -> domain mappers -------------------------------------------------

type TierRow = {
  id: string;
  event_id: string;
  name: string;
  price: number;
  quantity_total: number;
  quantity_sold: number;
};

type EventRow = {
  id: string;
  title: string;
  category: string;
  date: string;
  venue: string;
  city: string;
  image: string;
  price_from: number;
  organizer_name: string;
  organizer_avatar: string;
  description: string;
  featured: boolean;
};

const mapTier = (t: TierRow, available?: number): TicketTier => ({
  id: t.id,
  eventId: t.event_id,
  name: t.name,
  price: t.price,
  quantityTotal: t.quantity_total,
  quantitySold: t.quantity_sold,
  available: available ?? Math.max(0, t.quantity_total - t.quantity_sold),
});

const mapEvent = (e: EventRow, tiers: TicketTier[]): Event => ({
  id: e.id,
  title: e.title,
  category: e.category,
  date: e.date,
  venue: e.venue,
  city: e.city,
  image: e.image,
  priceFrom: e.price_from,
  organizer: { name: e.organizer_name, avatar: e.organizer_avatar },
  description: e.description,
  featured: e.featured,
  tiers,
});

// --- Server functions (run server-only; fall back to seed until Supabase is set)
//
// We query tables/views separately and join in JS rather than using PostgREST
// embedding, so the data layer doesn't depend on generated relationship types.

export const fetchEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<Event[]> => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return SEED_EVENTS_WITH_TIERS;

    const [{ data: events, error: eErr }, { data: tiers, error: tErr }, { data: avail, error: aErr }] =
      await Promise.all([
        supabase.from("events").select("*").order("date", { ascending: true }),
        supabase.from("ticket_tiers").select("*"),
        supabase.from("tier_availability").select("id, available"),
      ]);
    if (eErr) throw new Error(eErr.message);
    if (tErr) throw new Error(tErr.message);
    if (aErr) throw new Error(aErr.message);

    const availById = new Map((avail ?? []).map((a) => [a.id, a.available]));
    const tiersByEvent = new Map<string, TicketTier[]>();
    for (const t of tiers ?? []) {
      const list = tiersByEvent.get(t.event_id) ?? [];
      list.push(mapTier(t, availById.get(t.id)));
      tiersByEvent.set(t.event_id, list);
    }
    return (events ?? []).map((e) => mapEvent(e, tiersByEvent.get(e.id) ?? []));
  },
);

export const fetchEvent = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }): Promise<Event | null> => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return findSeedEvent(data.id) ?? null;

    const { data: event, error: eErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (eErr) throw new Error(eErr.message);
    if (!event) return null;

    const [{ data: tiers, error: tErr }, { data: avail, error: aErr }] = await Promise.all([
      supabase.from("ticket_tiers").select("*").eq("event_id", data.id),
      supabase.from("tier_availability").select("id, available").eq("event_id", data.id),
    ]);
    if (tErr) throw new Error(tErr.message);
    if (aErr) throw new Error(aErr.message);

    const availById = new Map((avail ?? []).map((a) => [a.id, a.available]));
    const mappedTiers = (tiers ?? []).map((t) => mapTier(t, availById.get(t.id)));
    return mapEvent(event, mappedTiers);
  });

// --- TanStack Query options (used by route loaders + components) --------------

export const eventsQueryOptions = () =>
  queryOptions({
    queryKey: ["events"],
    queryFn: () => fetchEvents(),
  });

export const eventQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["event", id],
    queryFn: () => fetchEvent({ data: { id } }),
  });
