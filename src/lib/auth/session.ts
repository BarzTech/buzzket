// Lightweight client-readable auth state. The AuthProvider keeps this in sync
// with the real Supabase session. Route guards read it synchronously without
// needing the async Supabase client.

const AUTH_FLAG = "bzk-authed";
const AUTH_USER = "bzk-user";

export type SessionUser = {
  id: string;
  label: string; // phone or email for display
  role: "buyer" | "organizer" | "admin";
};

export function setSessionFlag(user: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem(AUTH_FLAG, "1");
    window.localStorage.setItem(AUTH_USER, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(AUTH_FLAG);
    window.localStorage.removeItem(AUTH_USER);
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTH_FLAG) === "1";
}

export function getStoredUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}
