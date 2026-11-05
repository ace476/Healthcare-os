-- Prevent an admin from changing the family creator and then self-promoting
-- through membership_insert_self_as_owner.
create or replace function private.prevent_family_creator_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'The family creator cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_family_creator_change() from public, anon, authenticated;
drop trigger if exists prevent_family_creator_change on public.families;
create trigger prevent_family_creator_change
before update of created_by on public.families
for each row execute function private.prevent_family_creator_change();

-- A notification update must remain within a family the caller belongs to.
drop policy if exists notifications_update_recipient on public.notifications;
create policy notifications_update_recipient on public.notifications
for update to authenticated
using (
  recipient_user_id = (select auth.uid())
  and exists (
    select 1 from public.family_memberships m
    where m.family_id = notifications.family_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  recipient_user_id = (select auth.uid())
  and exists (
    select 1 from public.family_memberships m
    where m.family_id = notifications.family_id
      and m.user_id = (select auth.uid())
  )
);
