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
          price_from, organizer_name, organizer_avatar, organizer_id
        `,
        )
        .eq("id", eventId)
        .single();
      if (error) throw new Error(error.message);

      const [
        { data: tiers = [], error: tiersError },
        { data: availabilityRows = [], error: availabilityError },
      ] = await Promise.all([
        supabase
          .from("ticket_tiers")
          .select("id, name, price, quantity_total, quantity_sold")
          .eq("event_id", eventId),
        supabase
          .from("tier_availability")
          .select("id, available")
          .eq("event_id", eventId),
      ]);
      if (tiersError) throw new Error(tiersError.message);
      if (availabilityError) throw new Error(availabilityError.message);

      const availabilityByTier = new Map(
        (availabilityRows ?? []).map((row) => [row.id, row.available]),
      );

      const transformed = {
        ...data,
        priceFrom: data.price_from,
        organizerId: data.organizer_id,
        organizer: { name: data.organizer_name, avatar: data.organizer_avatar },
        tiers: (tiers ?? []).map((tier) => ({
          id: tier.id,
          name: tier.name,
          price: tier.price,
          quantity_total: tier.quantity_total,
          quantity_sold: tier.quantity_sold,
          available: availabilityByTier.get(tier.id) ?? 0,
        })),
      };
      return eventSchema.parse(transformed);
    },
  });
