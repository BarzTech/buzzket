export function isEligibleStaffRecoveryAccount(
  user: { phone?: string | null; phone_confirmed_at?: string | null } | null | undefined,
  roles: readonly string[],
): boolean {
  return Boolean(
    user?.phone && user.phone_confirmed_at &&
    roles.some((role) => role === "admin" || role === "organizer"),
  );
}
