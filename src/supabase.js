// src/supabase.js
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL  || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

/* ── snake_case ↔ camelCase converters ─────────────────────── */
export const toCamel = obj => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v
    ])
  );
};

export const toSnake = obj => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/([A-Z])/g, "_$1").toLowerCase(), v
    ])
  );
};

/* ── Typed database helpers ─────────────────────────────────── */
export const db = {
  async select(table, orderCol = null) {
    let q = supabase.from(table).select("*");
    if (orderCol) q = q.order(orderCol, { ascending: false });
    const { data, error } = await q;
    if (error) { console.error(`[db.select ${table}]`, error.message); return []; }
    return (data || []).map(toCamel);
  },

  async insert(table, row) {
    const { data, error } = await supabase.from(table).insert(toSnake(row)).select().single();
    if (error) { console.error(`[db.insert ${table}]`, error.message); return null; }
    return toCamel(data);
  },

  async update(table, id, updates) {
    const { data, error } = await supabase.from(table).update(toSnake(updates)).eq("id", id).select().single();
    if (error) { console.error(`[db.update ${table}]`, error.message); return null; }
    return toCamel(data);
  },

  async upsert(table, row, conflict = "id") {
    const { data, error } = await supabase.from(table).upsert(toSnake(row), { onConflict: conflict }).select().single();
    if (error) { console.error(`[db.upsert ${table}]`, error.message); return null; }
    return toCamel(data);
  },

  async delete(table, id) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) console.error(`[db.delete ${table}]`, error.message);
  },
};
