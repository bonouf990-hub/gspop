-- GSPOP Initial Schema
-- Multi-tenant property operations platform.
-- Run against a brand-new Supabase project (not shared with any other project).

create extension if not exists "pgcrypto";

-- ── Tenancy ──────────────────────────────────────────────────────────
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  label text not null
);

-- ── Users & Roles ────────────────────────────────────────────────────
-- auth.users is managed by Supabase Auth; this extends it with tenant + role.
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  full_name text not null,
  role text not null check (role in (
    'super_admin','tenant_admin','property_manager','supervisor','technician','vendor','resident'
  )),
  spend_limit numeric(12,2) default 0,
  phone text,
  created_at timestamptz not null default now()
);

-- ── Assets ───────────────────────────────────────────────────────────
create table assets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  name text not null,
  category text,
  qr_code text unique,
  rfid_tag text unique,
  installed_at date,
  expected_life_months int,
  created_at timestamptz not null default now()
);

-- ── Work Orders ──────────────────────────────────────────────────────
create table work_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  asset_id uuid references assets(id) on delete set null,
  type text not null check (type in ('preventive','corrective','inspection','incident')),
  priority text not null default 'medium' check (priority in ('low','medium','high','emergency')),
  status text not null default 'draft' check (status in (
    'draft','pending_approval','approved','rejected','assigned','in_progress',
    'paused','completed_by_technician','verified_by_supervisor','confirmed_by_resident',
    'closed','cancelled'
  )),
  title text not null,
  description text,
  created_by uuid not null references user_profiles(id),
  assigned_technician_id uuid references user_profiles(id),
  estimated_cost numeric(12,2),
  actual_cost numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Anti-misuse: GPS + timestamped check-in/out per job
create table work_order_checkins (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  technician_id uuid not null references user_profiles(id),
  type text not null check (type in ('check_in','check_out')),
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters numeric,
  timestamp timestamptz not null default now()
);

-- Anti-misuse: mandatory before/after photos
create table work_order_photos (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  stage text not null check (stage in ('before','after')),
  storage_path text not null,
  taken_at timestamptz not null default now(),
  taken_by uuid not null references user_profiles(id)
);

-- Supervisor quality rating + tenant satisfaction rating
create table work_order_ratings (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  rated_by uuid not null references user_profiles(id),
  rating_type text not null check (rating_type in ('supervisor_quality','resident_satisfaction')),
  score int not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- ── Vendors, Contracts, Purchasing ───────────────────────────────────
create table vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  category text,
  rating numeric(3,2),
  created_at timestamptz not null default now()
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  title text not null,
  sla_hours int,
  start_date date,
  end_date date,
  value numeric(14,2)
);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  vendor_id uuid references vendors(id),
  work_order_id uuid references work_orders(id),
  requested_by uuid not null references user_profiles(id),
  amount numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','escalated','fulfilled')),
  created_at timestamptz not null default now()
);

-- ── Inventory ────────────────────────────────────────────────────────
create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  sku text,
  name text not null,
  unit_of_measure text,
  quantity_on_hand numeric(12,2) not null default 0,
  reorder_threshold numeric(12,2) default 0,
  updated_at timestamptz not null default now()
);

-- Anti-misuse: every stock movement traceable to a person and (optionally) a work order
create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  work_order_id uuid references work_orders(id),
  moved_by uuid not null references user_profiles(id),
  movement_type text not null check (movement_type in ('receipt','issue','adjustment','return')),
  quantity numeric(12,2) not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ── Approvals (multi-level, spend-limit aware) ───────────────────────
create table approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('work_order','purchase_order')),
  entity_id uuid not null,
  approver_id uuid not null references user_profiles(id),
  level int not null,
  decision text not null default 'pending' check (decision in ('pending','approved','rejected','escalated')),
  spend_limit_at_decision numeric(12,2),
  comment text,
  decided_at timestamptz
);

-- ── Audit Trail (immutable, append-only) ─────────────────────────────
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  actor_id uuid references user_profiles(id),
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_log_entity on audit_log(entity_type, entity_id);
create index idx_work_orders_tenant on work_orders(tenant_id);
create index idx_work_orders_property on work_orders(property_id);
create index idx_work_orders_technician on work_orders(assigned_technician_id);

-- ── Row Level Security: tenant isolation ─────────────────────────────
alter table properties enable row level security;
alter table units enable row level security;
alter table assets enable row level security;
alter table work_orders enable row level security;
alter table vendors enable row level security;
alter table contracts enable row level security;
alter table purchase_orders enable row level security;
alter table inventory_items enable row level security;

create or replace function current_tenant_id() returns uuid as $$
  select tenant_id from user_profiles where id = auth.uid();
$$ language sql stable;

create policy tenant_isolation_properties on properties
  using (tenant_id = current_tenant_id());
create policy tenant_isolation_work_orders on work_orders
  using (tenant_id = current_tenant_id());
create policy tenant_isolation_vendors on vendors
  using (tenant_id = current_tenant_id());
create policy tenant_isolation_contracts on contracts
  using (tenant_id = current_tenant_id());
create policy tenant_isolation_purchase_orders on purchase_orders
  using (tenant_id = current_tenant_id());
create policy tenant_isolation_inventory on inventory_items
  using (tenant_id = current_tenant_id());
