import process from "node:process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

// Server-only Supabase admin client (service-role key). The `.server.ts` suffix
// keeps this out of the client bundle. The service-role key bypasses RLS, so
// only ever use this inside server functions / route loaders — never expose it.
//
// Read env INSIDE the function (per-request) so it works on edge runtimes where
// env binds at request time rather than module load.

export function isSupabaseAdminConfigured() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getSupabaseAdmin(): SupabaseClient<Database> | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
