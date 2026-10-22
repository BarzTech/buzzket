import { createHash, randomBytes } from "node:crypto";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";

import { normalizeWhatsAppNumber } from "../payments/phone";
import { isEligibleStaffRecoveryAccount } from "../auth/staff-recovery";
import { getSupabaseAdmin } from "../supabase/server";
import type { Database } from "../supabase/types";

const neutralRequest = { ok: true as const };
const genericOtpError = "That code is invalid or expired. If you cannot receive a code, contact Buzzket support for authorized account recovery.";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getRecoveryAuthClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function findStaffByEmail(email: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === email && user.email_confirmed_at);
    if (match) {
      const { data: roles, error: roleError } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", match.id)
        .in("role", ["admin", "organizer"]);
      if (roleError || !isEligibleStaffRecoveryAccount(match, roles?.map((row) => row.role) ?? [])) return null;
      return match;
    }
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function hasStaffRole(userId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "organizer"]);
  return !error && Boolean(data?.length);
}

const emailSchema = z.object({ email: z.string().trim().email().max(320) });

export const beginStaffPasswordRecovery = createServerFn({ method: "POST" })
  .validator(emailSchema)
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const authClient = getRecoveryAuthClient();
    const email = data.email.toLowerCase();
    if (!admin || !authClient) return neutralRequest;

    try {
      const { data: allowed, error: limitError } = await admin.rpc("claim_staff_recovery_attempt", {
        p_email_hash: sha256(email),
      });
      if (limitError || !allowed) return neutralRequest;
      const staff = await findStaffByEmail(email);
      if (!staff?.phone || !staff.phone_confirmed_at) return neutralRequest;
      const { error } = await authClient.auth.signInWithOtp({
        phone: staff.phone,
        options: { shouldCreateUser: false },
      });
      if (error) console.error("Staff password recovery message could not be sent.");
    } catch {
      // Keep account eligibility and provider responses indistinguishable.
      console.error("Staff password recovery request could not be processed.");
    }
    return neutralRequest;
  });

const verifySchema = emailSchema.extend({ code: z.string().trim().regex(/^\d{4,10}$/) });

export const verifyStaffPasswordRecoveryCode = createServerFn({ method: "POST" })
  .validator(verifySchema)
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    const authClient = getRecoveryAuthClient();
    if (!admin || !authClient) throw new Error("Password recovery is temporarily unavailable.");
    const staff = await findStaffByEmail(data.email.toLowerCase());
    if (!staff?.phone || !staff.phone_confirmed_at) throw new Error(genericOtpError);

    const { data: verification, error: verifyError } = await authClient.auth.verifyOtp({
      phone: staff.phone,
      token: data.code,
      type: "sms",
    });
    if (verifyError || !verification.user || !verification.session || verification.user.id !== staff.id ||
      verification.user.phone_confirmed_at == null || !(await hasStaffRole(staff.id))) {
      throw new Error(genericOtpError);
    }

    const recoveryToken = randomBytes(32).toString("base64url");
    const tokenHash = sha256(recoveryToken);
    const { error: clearError } = await admin.from("staff_password_recovery_grants").delete().eq("user_id", staff.id);
    if (clearError) throw new Error("Could not start password recovery. Request a new code.");
    const { error: insertError } = await admin.from("staff_password_recovery_grants").insert({
      token_hash: tokenHash,
      user_id: staff.id,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    if (insertError) throw new Error("Could not start password recovery. Request a new code.");

    // The SMS OTP session is deliberately server-only; revoke it before returning
    // a narrow, one-use password-reset grant to the browser.
    const { error: revokeError } = await admin.auth.admin.signOut(verification.session.access_token, "global");
    if (revokeError) {
      await admin.from("staff_password_recovery_grants").delete().eq("token_hash", tokenHash);
      throw new Error("Could not secure the recovery session. Request a new code.");
    }
    return { recoveryToken };
  });

export const setStaffPasswordWithRecoveryGrant = createServerFn({ method: "POST" })
  .validator(z.object({ recoveryToken: z.string().min(32).max(128), password: z.string().min(12).max(128) }))
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Password recovery is temporarily unavailable.");
    const { data: userId, error: consumeError } = await admin.rpc("consume_staff_recovery_grant", {
      p_token_hash: sha256(data.recoveryToken),
    });
    if (consumeError || !userId || !(await hasStaffRole(userId))) {
      throw new Error("This recovery session is invalid or expired. Start again from staff sign-in.");
    }
    const { error } = await admin.auth.admin.updateUserById(userId, { password: data.password });
    if (error) throw new Error("The password could not be updated. Start recovery again.");
    return { ok: true };
  });

const staffSessionSchema = z.object({ accessToken: z.string().min(1) });

export const authorizeStaffRecoveryPhoneChange = createServerFn({ method: "POST" })
  .validator(staffSessionSchema)
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Staff account security is temporarily unavailable.");
    const { data: result, error } = await admin.auth.getUser(data.accessToken);
    if (error || !result.user || !(await hasStaffRole(result.user.id))) throw new Error("A valid staff session is required.");
    const { data: claimData, error: claimError } = await admin.auth.getClaims(data.accessToken);
    const methods = claimData?.claims?.amr;
    const recentlyPasswordAuthenticated = Array.isArray(methods) && methods.some((method) =>
      method && typeof method === "object" && "method" in method && method.method === "password");
    if (claimError || !recentlyPasswordAuthenticated) throw new Error("Sign in with your staff email and password before changing your recovery phone.");
    return { ok: true, hasVerifiedRecoveryPhone: Boolean(result.user.phone && result.user.phone_confirmed_at) };
  });

export const auditStaffRecoveryPhoneChange = createServerFn({ method: "POST" })
  .validator(staffSessionSchema)
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Staff account security is temporarily unavailable.");
    const { data: result, error } = await admin.auth.getUser(data.accessToken);
    if (error || !result.user || !result.user.phone || !result.user.phone_confirmed_at || !(await hasStaffRole(result.user.id))) {
      throw new Error("Verify your phone number before recording it for account recovery.");
    }
    const { error: auditError } = await admin.from("staff_recovery_phone_audit").insert({
      user_id: result.user.id,
      phone_hash: sha256(normalizeWhatsAppNumber(result.user.phone)),
    });
    if (auditError) throw new Error("The verified number could not be recorded. Contact Buzzket support.");
    return { ok: true };
  });
