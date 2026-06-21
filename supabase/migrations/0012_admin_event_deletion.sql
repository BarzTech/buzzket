-- Allow admins to delete any event
drop policy if exists "events_admin_delete" on public.events;
create policy "events_admin_delete" on public.events
  for delete using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
