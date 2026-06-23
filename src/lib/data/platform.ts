import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

import { getSupabaseAdmin } from "../supabase/server";

export type PlatformSettings = {
  maintenanceMode: boolean;
  refundPolicy: string;
  slaHours: number;
  emailTemplateSubject: string;
  emailTemplateBody: string;
  smsTemplate: string;
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  maintenanceMode: false,
  refundPolicy: "",
  slaHours: 48,
  emailTemplateSubject: "Your Buzzket Ticket for {{eventName}}",
  emailTemplateBody: "Hi {{userName}}, here is your ticket for {{eventName}}.",
  smsTemplate: "Your Buzzket ticket for {{eventName}} is confirmed. Tier: {{ticketTier}}",
};

type PlatformSettingsRow = {
  maintenance_mode: boolean;
  refund_policy: string;
  sla_hours: number;
  email_template_subject: string;
  email_template_body: string;
  sms_template: string;
};

export function mapPlatformSettingsRow(row: PlatformSettingsRow): PlatformSettings {
  return {
    maintenanceMode: row.maintenance_mode,
    refundPolicy: row.refund_policy,
    slaHours: row.sla_hours,
    emailTemplateSubject: row.email_template_subject,
    emailTemplateBody: row.email_template_body,
    smsTemplate: row.sms_template,
  };
}

export function applyNotificationTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return DEFAULT_PLATFORM_SETTINGS;

  const { data, error } = await supabase
    .from("platform_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_PLATFORM_SETTINGS;
  return mapPlatformSettingsRow(data as PlatformSettingsRow);
}

export async function assertPlatformOperational(): Promise<void> {
  const settings = await fetchPlatformSettings();
  if (settings.maintenanceMode) {
    throw new Error("Buzzket is temporarily unavailable while we perform maintenance. Please try again later.");
  }
}

export const getPublicPlatformSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlatformSettings> => fetchPlatformSettings(),
);

export const publicPlatformSettingsQueryOptions = () =>
  queryOptions({
    queryKey: ["platform-settings"],
    queryFn: () => getPublicPlatformSettings(),
    staleTime: 60_000,
  });
