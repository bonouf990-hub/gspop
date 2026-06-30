-- GSPOP: Team management — property-scoped staff assignments and a
-- 'call_center' role, so access can be restricted to specific buildings
-- and the reporting hierarchy (already on user_profiles.reports_to_id)
-- can be managed from a real screen instead of raw SQL.

alter table user_profiles drop constraint user_profiles_role_check;
alter table user_profiles add constraint user_profiles_role_check
  check (role in (
    'super_admin','tenant_admin','property_manager','supervisor','technician',
    'vendor','resident','security','call_center'
  ));

create table property_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (user_id, property_id)
);

create index idx_property_assignments_user on property_assignments(user_id);
create index idx_property_assignments_property on property_assignments(property_id);

alter table property_assignments enable row level security;
create policy tenant_isolation_property_assignments on property_assignments
  using (property_id in (select id from properties where tenant_id = current_tenant_id()));
