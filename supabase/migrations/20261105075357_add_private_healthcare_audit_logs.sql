
-- Append-only metadata audit trail. Deliberately excludes medical values and free text.
create table if not exists private.audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  family_id uuid,
  previous_family_id uuid,
  table_name text not null,
  record_id text,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE'))
);
alter table private.audit_logs enable row level security;
revoke all on table private.audit_logs from public, anon, authenticated;
create index if not exists audit_logs_occurred_at_idx on private.audit_logs (occurred_at desc);
create index if not exists audit_logs_family_occurred_idx on private.audit_logs (family_id, occurred_at desc);
create index if not exists audit_logs_actor_occurred_idx on private.audit_logs (actor_user_id, occurred_at desc);

create or replace function private.capture_audit_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  new_row jsonb;
  old_row jsonb;
  selected_row jsonb;
begin
  if tg_op = 'INSERT' then
    new_row := to_jsonb(new);
    selected_row := new_row;
  elsif tg_op = 'UPDATE' then
    new_row := to_jsonb(new);
    old_row := to_jsonb(old);
    selected_row := new_row;
  else
    old_row := to_jsonb(old);
    selected_row := old_row;
  end if;

  insert into private.audit_logs (
    actor_user_id, family_id, previous_family_id, table_name, record_id, operation
  ) values (
    auth.uid(),
    case
      when selected_row ? 'family_id' then nullif(selected_row->>'family_id','')::uuid
      when tg_table_name = 'families' then nullif(selected_row->>'id','')::uuid
      else null
    end,
    case
      when old_row ? 'family_id' then nullif(old_row->>'family_id','')::uuid
      when tg_table_name = 'families' then nullif(old_row->>'id','')::uuid
      else null
    end,
    tg_table_name, selected_row->>'id', tg_op
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.capture_audit_event() from public, anon, authenticated;

drop trigger if exists audit_families on public.families;
create trigger audit_families after insert or update or delete on public.families for each row execute function private.capture_audit_event();
drop trigger if exists audit_family_memberships on public.family_memberships;
create trigger audit_family_memberships after insert or update or delete on public.family_memberships for each row execute function private.capture_audit_event();
drop trigger if exists audit_family_members on public.family_members;
create trigger audit_family_members after insert or update or delete on public.family_members for each row execute function private.capture_audit_event();
drop trigger if exists audit_appointments on public.appointments;
create trigger audit_appointments after insert or update or delete on public.appointments for each row execute function private.capture_audit_event();
drop trigger if exists audit_medications on public.medications;
create trigger audit_medications after insert or update or delete on public.medications for each row execute function private.capture_audit_event();
drop trigger if exists audit_medical_records on public.medical_records;
create trigger audit_medical_records after insert or update or delete on public.medical_records for each row execute function private.capture_audit_event();
drop trigger if exists audit_health_metrics on public.health_metrics;
create trigger audit_health_metrics after insert or update or delete on public.health_metrics for each row execute function private.capture_audit_event();
drop trigger if exists audit_emergency_info on public.emergency_info;
create trigger audit_emergency_info after insert or update or delete on public.emergency_info for each row execute function private.capture_audit_event();
drop trigger if exists audit_care_team on public.care_team;
create trigger audit_care_team after insert or update or delete on public.care_team for each row execute function private.capture_audit_event();
drop trigger if exists audit_notifications on public.notifications;
create trigger audit_notifications after insert or update or delete on public.notifications for each row execute function private.capture_audit_event();
drop trigger if exists audit_medication_dose_logs on public.medication_dose_logs;
create trigger audit_medication_dose_logs after insert or update or delete on public.medication_dose_logs for each row execute function private.capture_audit_event();
