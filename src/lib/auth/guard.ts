import { redirect } from "@tanstack/react-router";

import { isAuthenticated } from "./session";

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
    throw redirect({ to: "/login", search: { redirect: redirectHref } });
  }
}
