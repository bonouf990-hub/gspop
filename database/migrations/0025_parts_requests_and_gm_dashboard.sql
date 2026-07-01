-- Parts request flow: technician on-site requests parts from store,
-- storekeeper fulfills by delivery or pickup.

create table parts_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  work_order_id uuid not null references work_orders(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  requested_by uuid not null references user_profiles(id),
  quantity numeric(12,2) not null,
  status text not null default 'requested' check (status in (
    'requested','approved','picking','delivering','delivered','collected','rejected'
  )),
  delivery_method text not null default 'deliver' check (delivery_method in ('deliver','pickup')),
  delivery_location text,
  notes text,
  fulfilled_by uuid references user_profiles(id),
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_parts_requests_wo on parts_requests(work_order_id);
create index idx_parts_requests_status on parts_requests(status);

alter table parts_requests enable row level security;
create policy tenant_isolation_parts_requests on parts_requests
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

-- Contractor assignment tracking: which vendor is assigned to which properties
-- and their active project timeline.
create table vendor_assignments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  project_name text not null,
  scope text,
  start_date date not null,
  expected_end_date date,
  actual_end_date date,
  status text not null default 'active' check (status in ('active','completed','overdue','cancelled')),
  sla_days int,
  created_at timestamptz not null default now()
);

create index idx_vendor_assignments_vendor on vendor_assignments(vendor_id);
create index idx_vendor_assignments_property on vendor_assignments(property_id);

alter table vendor_assignments enable row level security;
create policy tenant_isolation_vendor_assignments on vendor_assignments
  using (vendor_id in (select id from vendors where tenant_id = current_tenant_id()))
  with check (vendor_id in (select id from vendors where tenant_id = current_tenant_id()));