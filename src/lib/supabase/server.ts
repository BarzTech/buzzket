import process from "node:process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

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

// Cache the client and reuse it across requests, re-creating only if the
// credentials change (supports edge runtimes that rebind env per request while
// avoiding connection churn on long-lived Node.js servers under load).
let cached: { key: string; client: SupabaseClient<Database> } | null = null;

export function getSupabaseAdmin(): SupabaseClient<Database> | null {
  console.log("getSupabaseAdmin env check:", {
    hasUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    keys: Object.keys(process.env).filter(k => k.includes("SUPABASE") || k.includes("VITE")),
  });
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  const key = `${url}:${serviceRoleKey}`;
  if (cached?.key === key) return cached.client;

  const client = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as any },
  }) as unknown as SupabaseClient<Database>;
  cached = { key, client };
  return client;
}
