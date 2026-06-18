import { createIsomorphicFn } from "@tanstack/start-fn-stubs";

import { getSupabaseBrowserClient } from "./client";

export const getSupabase = createIsomorphicFn()
  .client(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error("Supabase browser client is not configured.");
    }
    return client;
  })
  .server(async () => {
    const { getSupabaseAdmin } = await import("./server");
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error("Supabase admin client is not configured.");
    }
    return admin;
  });
