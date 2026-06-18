// Client-side persistent store for platform commission settings.
// In demo mode these are saved to localStorage so they survive page refreshes.
// When Supabase is connected, these would be stored in a platform_settings table.

const KEY = "bzk-commission";

export type CommissionSettings = {
  percent: number;   // e.g. 0.05 for 5%
  flatUGX: number;   // e.g. 500
};

const DEFAULTS: CommissionSettings = {
  percent: 0.05,
  flatUGX: 500,
};

export function getCommissionSettings(): CommissionSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveCommissionSettings(s: CommissionSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function resetCommissionSettings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
