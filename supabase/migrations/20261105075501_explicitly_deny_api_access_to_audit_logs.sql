-- Make the no-client-access rule explicit for the private audit table.
create policy audit_logs_no_api_access
on private.audit_logs
for all
to anon, authenticated
using (false)
with check (false);
