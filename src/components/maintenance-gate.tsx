import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";

import { MaintenancePage } from "@/components/maintenance-page";
import { getStoredUser } from "@/lib/auth/session";
import { publicPlatformSettingsQueryOptions } from "@/lib/data/platform";

const EXEMPT_PATH_PREFIXES = ["/admin", "/checkout/status"];

function isMaintenanceExempt(pathname: string): boolean {
  return EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const user = typeof window !== "undefined" ? getStoredUser() : null;
  const { data: settings } = useQuery({
    ...publicPlatformSettingsQueryOptions(),
    enabled: typeof window !== "undefined",
  });

  if (settings?.maintenanceMode && user?.role !== "admin" && !isMaintenanceExempt(pathname)) {
    return <MaintenancePage />;
  }

  return children;
}
