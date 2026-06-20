import { getSupabaseAdmin } from "./src/lib/supabase/server";

async function main() {
  console.log("Loading supabase client...");
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("Supabase client is null!");
    return;
  }

  console.log("Querying reservations table specific columns...");
  const { data, error } = await supabase
    .from("reservations")
    .select("status, contact_name, contact_email, contact_phone, unit_price, quantity, order_id")
    .limit(1);

  if (error) {
    console.error("Query failed with error:", error);
  } else {
    console.log("Success! Reservation columns exist. Data:", data);
  }
}

main().catch(console.error);
