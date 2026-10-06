import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

export async function assertOrganizerApproved(
  supabase: SupabaseClient<Database>,
  organizerId?: string | null,
): Promise<void> {
  if (!organizerId) return;

  const { data: adminRole } = await supabase.from("user_roles")
    .select("user_id").eq("user_id", organizerId).eq("role", "admin").maybeSingle();
  if (adminRole) return;

  const { data: profile, error: profileError } = await supabase
    .from("organizer_profiles")
    .select("approval_status")
    .eq("user_id", organizerId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile || profile.approval_status !== "approved") {
    throw new Error(
      "Your organizer account must be approved by an administrator before you can create or publish events.",
    );
  }
}
