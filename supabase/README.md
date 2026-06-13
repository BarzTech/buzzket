# Buzzket — Supabase setup

The app runs in **demo mode** with seed data until these env vars are set. Once a
Supabase project is connected it switches to live data, reservations, auth and QR
issuance automatically.

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
4. `seed.sql` — 8 launch events + 3 tiers each (optional demo data)

## 3. Auth

Enable **Phone** (SMS) and **Email** providers in Supabase Auth. Phone OTP is the
default sign-in method in the UI; email/password is the secondary option.

## How the concurrency fix works

`reserve_tickets(tier_id, qty)` takes a `SELECT … FOR UPDATE` lock on the tier
row, so two simultaneous checkouts serialize. It checks
`quantity_total − quantity_sold − active_reservations` inside that lock and
inserts a 10-minute hold. `confirm_reservation(...)` re-validates under lock,
increments `quantity_sold`, creates the paid order, and issues one ticket per
seat — each with a unique cryptographic `qr_token` (the QR payload).
