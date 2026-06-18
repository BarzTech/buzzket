import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function upsertEventServer(eventData: {
  id?: string;
  organizerId?: string;
  title: string;
  category: string;
  date: string;
  venue: string;
  city: string;
  image: string;
  description: string;
  featured: boolean;
  tiers: Array<{
    id?: string;
    name: string;
    price: number;
    quantity_total: number;
  }>;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase client not available");

  const { tiers, id, organizerId, ...eventFields } = eventData;
  const eventId = id ?? randomUUID();
  const priceFrom = Math.min(...tiers.map((tier) => tier.price));

  // Upsert the event itself.
  const { data: eventResult, error: eventError } = await supabase
    .from("events")
    .upsert({
      id: eventId,
      title: eventFields.title,
      category: eventFields.category,
      date: eventFields.date,
      venue: eventFields.venue,
      city: eventFields.city,
      image: eventFields.image,
      description: eventFields.description,
      featured: eventFields.featured,
      price_from: priceFrom,
      organizer_id: organizerId || null,
      organizer_name: "Buzzket Organiser",
      organizer_avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=70",
    })
    .select("id").single();

  if (eventError) throw new Error(eventError.message);
  const savedEventId = eventResult.id;

  // Get existing tiers for this event.
  const { data: existingTiers, error: existingTiersError } = await supabase
    .from("ticket_tiers")
    .select("id").eq("event_id", savedEventId);
  if (existingTiersError) throw new Error(existingTiersError.message);
  const existingTierIds = existingTiers.map((t: { id: string }) => t.id);

  // Figure out which tiers to create, update, or delete.
  const incomingTierIds = tiers.map((t) => t.id).filter(Boolean);
  const tiersToUpsert: Array<{
    event_id: string;
    name: string;
    price: number;
    quantity_total: number;
    id?: string;
  }> = tiers.map((t) => {
    const tier: {
      event_id: string;
      name: string;
      price: number;
      quantity_total: number;
      id?: string;
    } = {
      name: t.name,
      price: t.price,
      quantity_total: t.quantity_total,
      event_id: savedEventId,
    };
    if (t.id) {
      tier.id = t.id;
    }
    return tier;
  });
  const tiersToDelete = existingTierIds.filter((id) => !incomingTierIds.includes(id));

  // Do the tier writes.
  if (tiersToUpsert.length > 0) {
    const { error: upsertError } = await supabase.from("ticket_tiers").upsert(tiersToUpsert);
    if (upsertError) throw new Error(upsertError.message);
  }
  if (tiersToDelete.length > 0) {
    const { error: deleteError } = await supabase.from("ticket_tiers").delete().in("id", tiersToDelete);
    if (deleteError) throw new Error(deleteError.message);
  }

  return { id: savedEventId };
}
