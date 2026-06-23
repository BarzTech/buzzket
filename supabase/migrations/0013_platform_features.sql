-- Migration: Platform Settings & Organizer Approvals

-- Add approval_status to organizers (default pending, but update existing to approved)
ALTER TABLE public.organizer_profiles 
ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending' 
CHECK (approval_status IN ('pending', 'approved', 'rejected'));

UPDATE public.organizer_profiles SET approval_status = 'approved' WHERE approval_status = 'pending';

-- Create platform settings table (singleton)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_mode boolean NOT NULL DEFAULT false,
  refund_policy text NOT NULL DEFAULT '',
  sla_hours integer NOT NULL DEFAULT 48,
  email_template_subject text NOT NULL DEFAULT 'Your Buzzket Ticket for {{eventName}}',
  email_template_body text NOT NULL DEFAULT 'Hi {{userName}}, here is your ticket for {{eventName}}.',
  sms_template text NOT NULL DEFAULT 'Your Buzzket ticket for {{eventName}} is confirmed. Tier: {{ticketTier}}'
);

-- Insert the default single row
INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Enable RLS on platform settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to platform settings
DROP POLICY IF EXISTS "platform_settings_public_read" ON public.platform_settings;
CREATE POLICY "platform_settings_public_read" ON public.platform_settings
  FOR SELECT USING (true);

-- Allow admin updates to platform settings
DROP POLICY IF EXISTS "platform_settings_admin_update" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_update" ON public.platform_settings
  FOR UPDATE USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "platform_settings_admin_insert" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_insert" ON public.platform_settings
  FOR INSERT WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Allow admins to update organizer profiles (for approvals)
DROP POLICY IF EXISTS "organizer_profiles_admin_update" ON public.organizer_profiles;
CREATE POLICY "organizer_profiles_admin_update" ON public.organizer_profiles
  FOR UPDATE USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
