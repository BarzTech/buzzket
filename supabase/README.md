# Buzzket — Supabase setup

The app expects a connected Supabase project for launch. Without these env vars,
auth, event data, reservations, checkout, QR issuance, admin tools and scanning
will fail closed instead of using local sample data.

## 1. Environment variables

Copy `.env.example` to `.env` and fill in:

| Var | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | public project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | public anon key (RLS-protected) |
| `SUPABASE_URL` | server | same project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server | **secret** — bypasses RLS, never shipped to the client |

## 2. Apply the schema

Run the migrations in order against your project (SQL editor or `supabase db push`):

1. `migrations/0001_init_schema.sql` — tables (events, ticket_tiers, orders, order_items, tickets, reservations)
2. `migrations/0002_reservations_rpc.sql` — `tier_availability` view + `reserve_tickets` / `confirm_reservation` RPCs (the overselling fix)
3. `migrations/0003_rls.sql` — Row Level Security policies
4. `migrations/0004_dashboard_stats.sql` — dashboard reporting RPC
5. `migrations/0005_launch_hardening.sql` — role checks, event-scoped promo codes, atomic check-in RPC
6. `seed.sql` — optional initial launch catalog data

## 3. Auth

Enable **Phone** (SMS) and **Email** providers in Supabase Auth. Phone OTP is the
default sign-in method in the UI; email/password is the secondary option.

Set `user_metadata.role` to one of:

- `buyer`
- `organizer`
- `admin`

Admins sign in at `/admin/login`. Organisers register at `/organizer/register`.

## How the concurrency fix works

`reserve_tickets(tier_id, qty)` takes a `SELECT … FOR UPDATE` lock on the tier
row, so two simultaneous checkouts serialize. It checks
`quantity_total − quantity_sold − active_reservations` inside that lock and
inserts a 10-minute hold. `confirm_reservation(...)` re-validates under lock,
increments `quantity_sold`, creates the paid order, and issues one ticket per
seat — each with a unique cryptographic `qr_token` (the QR payload).

## Scanner concurrency

`check_in_ticket(qr_token)` updates tickets with `where status = 'valid'`.
Multiple phones can scan the same ticket at the same time: one receives
`valid`, later concurrent attempts receive `already_used`. The RPC also checks
that the signed-in scanner is either an admin or the owner of the event.
