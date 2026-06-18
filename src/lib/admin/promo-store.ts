import { getSupabaseBrowserClient } from "../supabase/client";

export type PromoCode = {
  id: string;
  eventId: string;
  eventTitle: string;
  code: string;          // e.g. "BUZZKET10"
  type: "percent" | "flat"; // discount type
  value: number;         // percentage (0-100) or flat UGX amount
  maxUses: number | null;   // null = unlimited
  usedCount: number;
  active: boolean;
  expiresAt: string | null; // ISO date string or null
  createdAt: string;
};

export type PromoEvent = {
  id: string;
  title: string;
};

export async function getPromoEvents(): Promise<PromoEvent[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("events")
    .select("id,title")
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPromoCodes(): Promise<PromoCode[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("promo_codes")
    .select("id,event_id,code,type,value,max_uses,used_count,active,expires_at,created_at,events(title)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    eventTitle: (row.events as { title?: string } | null)?.title ?? row.event_id,
    code: row.code,
    type: row.type,
    value: row.value,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    active: row.active,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export async function createPromoCode(input: Omit<PromoCode, "id" | "usedCount" | "active" | "createdAt" | "eventTitle">) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("promo_codes").insert({
    event_id: input.eventId,
    code: input.code,
    type: input.type,
    value: input.value,
    max_uses: input.maxUses,
    expires_at: input.expiresAt,
  });
  if (error) throw new Error(error.message);
}

export async function updatePromoCode(id: string, patch: Partial<Pick<PromoCode, "active">>) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("promo_codes").update({ active: patch.active }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePromoCode(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
