-- GSPOP: Restrict resident/tenant profile visibility.
--
-- Previously, any staff member in the tenant could read ANY user_profiles
-- row (so supervisors, security, call center could browse full resident
-- profiles) and ANY lease (full rent/occupant/contact details), which is
-- far too broad. Staff directory data (technicians, supervisors, etc.)
-- still needs to be tenant-wide visible for dashboards/org charts — only
-- RESIDENT profiles and lease/rent data get locked down.
--
-- New rule: a resident's own profile + lease is visible to themselves and
-- to tenant_admin/property_manager only. Everyone else (security, call
-- center, supervisor, technician) gets zero direct table access to
-- resident profiles or leases — they go through the narrow,
-- SECURITY DEFINER call_center_lookup() function below instead, which
-- returns only the few fields actually needed to identify a caller.

-- ── 1. user_profiles: staff directory stays open, residents locked down ──
drop policy if exists user_profiles_tenant_read on user_profiles;
create policy user_profiles_tenant_read on user_profiles
  for select using (
    id = auth.uid()
    or (role != 'resident' and tenant_id = current_tenant_id())
    or (role = 'resident' and current_user_role() in ('tenant_admin', 'property_manager'))
  );

-- ── 2. leases: only the resident themselves or admins/managers ─────────
drop policy if exists resident_own_lease on leases;
create policy leases_restricted_access on leases
  for select using (
    primary_resident_id = auth.uid()
    or (
      current_user_role() in ('tenant_admin', 'property_manager')
      and unit_id in (
        select id from units where property_id in (
          select id from properties where tenant_id = current_tenant_id()
        )
      )
    )
  );

-- ── 3. Narrow lookup function for call center / security operational use ─
-- Returns only what's needed to identify a caller and route a complaint —
-- no spend limits, no full profile, no raw table access. Restricted to the
-- roles that actually need it; anyone else gets an empty result.
create or replace function call_center_lookup(search_term text)
returns table (
  lease_id uuid,
  unit_id uuid,
  primary_resident_id uuid,
  tenant_full_name text,
  occupant_count int,
  unit_label text,
  property_id uuid,
  property_name text,
  phone text
) as $$
  select
    l.id as lease_id,
    l.unit_id,
    l.primary_resident_id,
    l.tenant_full_name,
    l.occupant_count,
    u.label as unit_label,
    u.property_id,
    p.name as property_name,
    up.phone
  from leases l
  join units u on u.id = l.unit_id
  join properties p on p.id = u.property_id
  left join user_profiles up on up.id = l.primary_resident_id
  where p.tenant_id = current_tenant_id()
    and current_user_role() in ('call_center', 'security', 'tenant_admin', 'property_manager')
    and l.status = 'active'
    and (
      l.tenant_full_name ilike '%' || search_term || '%'
      or up.phone ilike '%' || search_term || '%'
    )
  limit 10;
$$ language sql stable security definer set search_path = public;
