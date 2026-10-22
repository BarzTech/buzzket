-- Server-only state for SMS staff recovery. No OTP or password is stored here;
-- recovery grants are opaque random tokens stored only as SHA-256 hashes.
create table if not exists public.staff_password_recovery_limits (
  email_hash text primary key check (email_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0)
);

create table if not exists public.staff_password_recovery_grants (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists staff_password_recovery_grants_user_id_idx
  on public.staff_password_recovery_grants(user_id);

create table if not exists public.staff_recovery_phone_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_hash text not null check (phone_hash ~ '^[a-f0-9]{64}$'),
  verified_at timestamptz not null default now()
);

alter table public.staff_password_recovery_limits enable row level security;
alter table public.staff_password_recovery_grants enable row level security;
alter table public.staff_recovery_phone_audit enable row level security;
revoke all on public.staff_password_recovery_limits, public.staff_password_recovery_grants,
  public.staff_recovery_phone_audit from public, anon, authenticated;
grant all on public.staff_password_recovery_limits, public.staff_password_recovery_grants,
  public.staff_recovery_phone_audit to service_role;

create or replace function public.claim_staff_recovery_attempt(p_email_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_attempts integer;
begin
  if p_email_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  delete from public.staff_password_recovery_limits
   where window_started_at < now() - interval '2 days';
  insert into public.staff_password_recovery_limits as limits(email_hash, window_started_at, attempts)
    values (p_email_hash, now(), 1)
  on conflict (email_hash) do update set
    window_started_at = case
      when limits.window_started_at < now() - interval '1 hour' then now()
      else limits.window_started_at end,
    attempts = case
      when limits.window_started_at < now() - interval '1 hour' then 1
      else limits.attempts + 1 end
  returning attempts into v_attempts;
  return v_attempts <= 5;
end $$;
revoke all on function public.claim_staff_recovery_attempt(text) from public, anon, authenticated;
grant execute on function public.claim_staff_recovery_attempt(text) to service_role;

create or replace function public.consume_staff_recovery_grant(p_token_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user_id uuid;
begin
  update public.staff_password_recovery_grants
     set consumed_at = now()
   where token_hash = p_token_hash
     and consumed_at is null
     and expires_at > now()
  returning user_id into v_user_id;
  return v_user_id;
end $$;
revoke all on function public.consume_staff_recovery_grant(text) from public, anon, authenticated;
grant execute on function public.consume_staff_recovery_grant(text) to service_role;
