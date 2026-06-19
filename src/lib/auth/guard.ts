import { redirect } from "@tanstack/react-router";

import { getStoredUser, isAuthenticated, type SessionUser } from "./session";

function safeRedirectHref(redirectHref: string) {
  if (!redirectHref.startsWith("/") || redirectHref.startsWith("//")) return "/";
  if (redirectHref.startsWith("/login") || redirectHref.startsWith("/admin/login")) return "/";
  if (redirectHref.length > 200) return "/";
  return redirectHref;
}

// Returns whether the current visitor is authenticated. Safe on the server
// (returns false there; enforcement happens on the client after hydration).
export function requireAuth(): boolean {
  return isAuthenticated();
}

// For use in a route's `beforeLoad`. Redirects unauthenticated users to /login.
// During SSR there is no client session available, so we defer enforcement to
// the client to avoid redirecting already-authenticated users on first paint.
export function requireAuthOrRedirect(redirectHref: string) {
  if (typeof window === "undefined") return;
  if (!isAuthenticated()) {
    throw redirect({ to: "/login", search: { redirect: safeRedirectHref(redirectHref) } });
  }
}

export function requireRoleOrRedirect(
  role: SessionUser["role"] | SessionUser["role"][],
  redirectHref: string,
) {
  if (typeof window === "undefined") return;
  const user = getStoredUser();
  const roles = Array.isArray(role) ? role : [role];
  if (!user || !roles.includes(user.role)) {
    const loginRoute = roles.includes("admin") ? "/admin/login" : "/login";
    throw redirect({ to: loginRoute, search: { redirect: safeRedirectHref(redirectHref) } });
  }
}
