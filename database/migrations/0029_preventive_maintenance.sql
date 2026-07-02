-- Preventive maintenance schedules that auto-generate work orders
create table maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  unit_id uuid references units(id),
  asset_id uuid references assets(id),
  title text not null,
  description text,
  type text not null default 'preventive' check (type in ('preventive', 'inspection', 'certification')),
  frequency text not null check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'biannual', 'annual')),
  trade text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assigned_technician_id uuid references user_profiles(id),
  assigned_vendor_id uuid references vendors(id),
  last_generated_at timestamptz,
  next_due_date date not null,
  is_active boolean not null default true,
  estimated_duration_hours numeric(5,2),
  checklist jsonb,
  created_by uuid not null references user_profiles(id),
  created_at timestamptz not null default now()
);

alter table maintenance_schedules enable row level security;
create policy tenant_isolation_maintenance_schedules on maintenance_schedules
  for all using (tenant_id = current_tenant_id());

-- Track which work orders were auto-generated from schedules
alter table work_orders add column maintenance_schedule_id uuid references maintenance_schedules(id);
