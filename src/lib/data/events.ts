import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";

// Helpers
// -------

// The Zod schema for a single event, used for validation both on the server
// and when parsing data fetched on the client.
export const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  date: z.string(),
  venue: z.string(),
  city: z.string(),
  image: z.string(),
  priceFrom: z.number().nonnegative(),
  organizerId: z.string().optional().nullable(),
  organizer: z.object({ name: z.string(), avatar: z.string() }),
  description: z.string(),
  featured: z.boolean(),
  // Tiers are a sub-table, joined.
  tiers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price: z.number().nonnegative(),
      quantity_total: z.number().int().positive(),
      quantity_sold: z.number().int().nonnegative(),
      // The view adds this calculated field.
      available: z.number().int().nonnegative(),
    }),
  ),
});

// When fetching a list, we get a subset of fields (e.g. no `description`).
export const eventCardSchema = eventSchema.pick({
  id: true,
  title: true,
  category: true,
  date: true,
  venue: true,
  city: true,
  image: true,
  priceFrom: true,
  featured: true,
  organizerId: true,
});

// We can use Zod to infer the TS types from our schemas.
export type Event = z.infer<typeof eventSchema>;
export type EventCard = z.infer<typeof eventCardSchema>;

export const upsertEventSchema = z.object({
  id: z.string().optional(),
  organizerId: z.string().optional(),
  title: z.string(),
  category: z.string(),
  date: z.string(),
  venue: z.string(),
  city: z.string(),
  image: z.string().url(),
  description: z.string(),
  featured: z.boolean(),
  tiers: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        price: z.number().int().nonnegative(),
        quantity_total: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const upsertEvent = createServerFn({ method: "POST" })
  .validator(upsertEventSchema)
  .handler(async ({ data: eventData }) => {
    const { upsertEventServer } = await import("./events.server");
    return upsertEventServer(eventData);
  });

// Query Options
// -------------
// We're using the query options pattern. This improves type-safety and makes
// it easy to share query definitions between `useQuery` and `loader`s.

export const eventsQueryOptions = (organizerId?: string) =>
  queryOptions<EventCard[]>({
    queryKey: ["events", { organizerId }],
    queryFn: async () => {
      let supabase = null;
      try {
        supabase = await getSupabase();
      } catch (e) {
        console.error("Error calling getSupabase in eventsQueryOptions:", e);
        supabase = null;
      }

      if (!supabase) {
        throw new Error("Supabase is not configured. Event catalog data is unavailable.");
      }

      let query = supabase.from("events").select(
        `
        id, title, category, date, venue, city, image, featured, price_from, organizer_id
      `,
      );
      if (organizerId) {
        query = query.eq("organizer_id", organizerId);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return z.array(eventCardSchema).parse(
        data.map((row) => ({
          id: row.id,
          title: row.title,
          category: row.category,
          date: row.date,
          venue: row.venue,
          city: row.city,
          image: row.image,
          featured: row.featured,
          priceFrom: row.price_from,
          organizerId: row.organizer_id,
        })),
      );
    },
  });

export const eventQueryOptions = (eventId: string) =>
  queryOptions<Event>({
    queryKey: ["events", eventId],
    queryFn: async () => {
      let supabase = null;
      try {
        supabase = await getSupabase();
      } catch (e) {
        console.error("Error calling getSupabase in eventQueryOptions:", e);
        supabase = null;
      }
      if (!supabase) {
        throw new Error("Supabase is not configured. Event details are unavailable.");
      }

      const { data, error } = await supabase
        .from("events")
        .select(
          `
          id, title, category, date, venue, city, image, description, featured,
          price_from, organizer_name, organizer_avatar, organizer_id,
          tiers:ticket_tiers(id, name, price, quantity_total, quantity_sold, available:tier_availability(available))
        `,
        )
        .eq("id", eventId)
        .single();
      if (error) throw new Error(error.message);
      // The `available` field is a nested singleton array from the view, so we
      // have to use `transform` to pluck it out before parsing.
      const transformed = {
        ...data,
        priceFrom: data.price_from,
        organizerId: data.organizer_id,
        organizer: { name: data.organizer_name, avatar: data.organizer_avatar },
        tiers: (data.tiers ?? []).map((t) => {
          const availability = t.available as { available: number } | { available: number }[] | null;
          const available = Array.isArray(availability)
            ? availability[0]?.available ?? 0
            : availability?.available ?? 0;
          return {
            id: t.id,
            name: t.name,
            price: t.price,
            quantity_total: t.quantity_total,
            quantity_sold: t.quantity_sold,
            available,
          };
        }),
      };
      return eventSchema.parse(transformed);
    },
  });
