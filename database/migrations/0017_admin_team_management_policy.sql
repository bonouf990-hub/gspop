-- GSPOP: Allow tenant_admin/property_manager to manage other staff
-- profiles (role, department, reports_to) within their own tenant.
-- Uses a SECURITY DEFINER helper (same pattern as current_tenant_id) to
-- avoid the RLS-recursion bug we hit earlier.

create or replace function current_user_role() returns text as $$
  select role from user_profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create policy user_profiles_admin_manage on user_profiles
  for update using (
    tenant_id = current_tenant_id()
    and current_user_role() in ('tenant_admin', 'property_manager')
  );
