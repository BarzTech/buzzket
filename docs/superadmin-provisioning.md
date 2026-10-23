# Superadmin provisioning

The staff authorization system uses the protected `public.user_roles` table and the server-side `public.is_admin()` check. Do not set roles in `user_metadata` or client code.

Run `node scripts/provision-superadmin.mjs` from a trusted operator machine with these environment variables set securely:

- `SUPABASE_URL`: project URL
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service role key
- `SUPERADMIN_PASSWORD`: initial or rotated password
- `SUPERADMIN_EXPECTED_USER_ID`: required only when the target email already exists; obtain and verify the UUID in Supabase Authentication → Users before setting it

The script creates the target auth user if missing. For an existing user it refuses to proceed unless the expected UUID matches, then rotates the password and idempotently grants the existing `admin` role. Never run this script in browser code, commit its secrets, or paste the password into SQL. Use a new secret value to rotate the password without changing application source.
