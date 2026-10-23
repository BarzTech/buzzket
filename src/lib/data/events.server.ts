import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertOrganizerApproved } from "@/lib/data/organizers.server";

export async function upsertEventServer(eventData: {
  accessToken: string;
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
  feeResponsibility: "customer" | "organizer";
  tiers: Array<{
    id?: string;
    name: string;
    price: number;
    quantity_total: number;
  }>;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase client not available");

  const { data: authData, error: authError } = await supabase.auth.getUser(eventData.accessToken);
  if (authError || !authData.user) throw new Error("Sign in again before saving this event.");
  const actorId = authData.user.id;
  const { data: roles, error: rolesError } = await supabase.from("user_roles").select("role").eq("user_id", actorId);
  if (rolesError) throw new Error("Could not verify event permissions.");
  const isAdmin = (roles ?? []).some((role) => role.role === "admin");
  const isOrganizer = (roles ?? []).some((role) => role.role === "organizer");
  if (!isAdmin && !isOrganizer) throw new Error("An approved organiser account is required to manage events.");
  if (eventData.id) {
    const { data: existing, error: existingError } = await supabase.from("events").select("organizer_id").eq("id", eventData.id).maybeSingle();
    if (existingError) throw new Error("Could not verify event ownership.");
    if (!existing || (!isAdmin && existing.organizer_id !== actorId)) throw new Error("You are not authorized to edit this event.");
  }

  const { tiers, id, accessToken, organizerId: requestedOrganizerId, ...eventFields } = eventData;
  void accessToken;
  const organizerId = isAdmin ? (requestedOrganizerId ?? actorId) : actorId;
  if (!isAdmin) eventFields.featured = false;
  await assertOrganizerApproved(supabase, organizerId);
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
      fee_responsibility: eventFields.feeResponsibility,
      price_from: priceFrom,
      organizer_id: organizerId || null,
      organizer_name: "Buzzket Organiser",
      organizer_avatar: "",
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
