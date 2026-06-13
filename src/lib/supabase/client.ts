import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

// Browser Supabase client (anon key). These VITE_-prefixed values are public
// and safe to ship to the client — never put the service-role key here. Define
// them in `.env` (see `.env.example`).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

// Returns the singleton browser client, or null if Supabase isn't configured
// yet. Callers should handle the null case (auth/UI degrades gracefully).
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createClient<Database>(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}
