
-- Enforce same-family references and bind audit attribution to the caller.
drop policy if exists appointments_insert_caregiver on public.appointments;
create policy appointments_insert_caregiver on public.appointments for insert to authenticated
with check (
  exists (select 1 from public.family_memberships m where m.family_id=appointments.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver'))
  and exists (select 1 from public.family_members fm where fm.id=appointments.family_member_id and fm.family_id=appointments.family_id)
  and created_by=(select auth.uid())
);
drop policy if exists appointments_update_caregiver on public.appointments;
create policy appointments_update_caregiver on public.appointments for update to authenticated
using (exists (select 1 from public.family_memberships m where m.family_id=appointments.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver')))
with check (
  exists (select 1 from public.family_memberships m where m.family_id=appointments.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver'))
  and exists (select 1 from public.family_members fm where fm.id=appointments.family_member_id and fm.family_id=appointments.family_id)
);
drop policy if exists care_team_insert_caregiver on public.care_team;
create policy care_team_insert_caregiver on public.care_team for insert to authenticated
with check (
  exists (select 1 from public.family_memberships m where m.family_id=care_team.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver'))
  and (family_member_id is null or exists (select 1 from public.family_members fm where fm.id=care_team.family_member_id and fm.family_id=care_team.family_id))
);
drop policy if exists care_team_update_caregiver on public.care_team;
create policy care_team_update_caregiver on public.care_team for update to authenticated
using (exists (select 1 from public.family_memberships m where m.family_id=care_team.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver')))
with check (
  exists (select 1 from public.family_memberships m where m.family_id=care_team.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver'))
  and (family_member_id is null or exists (select 1 from public.family_members fm where fm.id=care_team.family_member_id and fm.family_id=care_team.family_id))
);
drop policy if exists emergency_insert_caregiver on public.emergency_info;
create policy emergency_insert_caregiver on public.emergency_info for insert to authenticated
with check (
  exists (select 1 from public.family_memberships m where m.family_id=emergency_info.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver'))
  and exists (select 1 from public.family_members fm where fm.id=emergency_info.family_member_id and fm.family_id=emergency_info.family_id)
  and updated_by=(select auth.uid())
);
drop policy if exists emergency_update_caregiver on public.emergency_info;
create policy emergency_update_caregiver on public.emergency_info for update to authenticated
using (exists (select 1 from public.family_memberships m where m.family_id=emergency_info.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver')))
with check (
  exists (select 1 from public.family_memberships m where m.family_id=emergency_info.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver'))
  and exists (select 1 from public.family_members fm where fm.id=emergency_info.family_member_id and fm.family_id=emergency_info.family_id)
  and updated_by=(select auth.uid())
);
drop policy if exists metrics_insert_caregiver on public.health_metrics;
create policy metrics_insert_caregiver on public.health_metrics for insert to authenticated
with check (
  exists (select 1 from public.family_memberships m where m.family_id=health_metrics.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver'))
  and (family_member_id is null or exists (select 1 from public.family_members fm where fm.id=health_metrics.family_member_id and fm.family_id=health_metrics.family_id))
  and created_by=(select auth.uid())
);
drop policy if exists metrics_update_caregiver on public.health_metrics;
create policy metrics_update_caregiver on public.health_metrics for update to authenticated
using (exists (select 1 from public.family_memberships m where m.family_id=health_metrics.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver')))
with check (
  exists (select 1 from public.family_memberships m where m.family_id=health_metrics.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver'))
  and (family_member_id is null or exists (select 1 from public.family_members fm where fm.id=health_metrics.family_member_id and fm.family_id=health_metrics.family_id))
);
drop policy if exists records_insert_caregiver on public.medical_records;
create policy records_insert_caregiver on public.medical_records for insert to authenticated
with check (
  exists (select 1 from public.family_memberships m where m.family_id=medical_records.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver'))
  and (family_member_id is null or exists (select 1 from public.family_members fm where fm.id=medical_records.family_member_id and fm.family_id=medical_records.family_id))
  and uploaded_by=(select auth.uid())
  and storage_path like medical_records.family_id::text || '/%'
);
drop policy if exists records_update_caregiver on public.medical_records;
create policy records_update_caregiver on public.medical_records for update to authenticated
using (exists (select 1 from public.family_memberships m where m.family_id=medical_records.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver')))
with check (
  exists (select 1 from public.family_memberships m where m.family_id=medical_records.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver'))
  and (family_member_id is null or exists (select 1 from public.family_members fm where fm.id=medical_records.family_member_id and fm.family_id=medical_records.family_id))
  and storage_path like medical_records.family_id::text || '/%'
);
drop policy if exists medications_insert_caregiver on public.medications;
create policy medications_insert_caregiver on public.medications for insert to authenticated
with check (
  exists (select 1 from public.family_memberships m where m.family_id=medications.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver'))
  and (family_member_id is null or exists (select 1 from public.family_members fm where fm.id=medications.family_member_id and fm.family_id=medications.family_id))
  and created_by=(select auth.uid())
);
drop policy if exists medications_update_caregiver on public.medications;
create policy medications_update_caregiver on public.medications for update to authenticated
using (exists (select 1 from public.family_memberships m where m.family_id=medications.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver')))
with check (
  exists (select 1 from public.family_memberships m where m.family_id=medications.family_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','caregiver'))
  and (family_member_id is null or exists (select 1 from public.family_members fm where fm.id=medications.family_member_id and fm.family_id=medications.family_id))
);
