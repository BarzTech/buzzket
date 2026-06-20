-- Add contact columns to public.reservations to support background IPN order confirmations
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS contact_name text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS unit_price integer;
