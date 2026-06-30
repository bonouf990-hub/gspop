-- GSPOP: Asset lifecycle/spares, tenant complaints, and full apartment/leasing model.

-- ── 1. Asset lifecycle & spare-parts control ─────────────────────────
-- Tracks an asset's full life: installed -> in service -> removed -> repaired ->
-- kept as backup spare -> redeployed -> disposed. Every transition is logged so
-- "secondhand parts kept as backup" are never untracked.

alter table assets
  add column status text not null default 'in_service'
    check (status in ('in_service','removed','under_repair','spare_backup','redeployed','disposed')),
  add column condition text not null default 'new'
    check (condition in ('new','refurbished','used','damaged')),
  add column replaced_by_asset_id uuid references assets(id),
  add column maintenance_cycle_months int,
  add column next_maintenance_due date,
  add column storage_location text; -- where a spare/backup physically sits when not installed

create table asset_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  event_type text not null check (event_type in (
    'installed','removed','sent_for_repair','repaired','moved_to_spare',
    'redeployed','disposed','maintenance_completed'
  )),
  work_order_id uuid references work_orders(id),
  performed_by uuid not null references user_profiles(id),
  notes text,
  event_date timestamptz not null default now()
);

create index idx_asset_lifecycle_asset on asset_lifecycle_events(asset_id);

-- ── 2. Tenant complaints / resident-reported issues ──────────────────
-- Resident raises a complaint with photo from the app; technician must
-- acknowledge and act, with an SLA clock running from submission.

create table complaints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  resident_id uuid not null references user_profiles(id),
  title text not null,
  description text not null,
  status text not null default 'submitted' check (status in (
    'submitted','acknowledged','assigned','in_progress','resolved','closed','rejected'
  )),
  priority text not null default 'medium' check (priority in ('low','medium','high','emergency')),
  submitted_at timestamptz not null default now(),
  sla_minutes int not null default 60, -- time allowed to acknowledge, configurable per tenant/property
  acknowledged_at timestamptz,
  acknowledged_by uuid references user_profiles(id),
  work_order_id uuid references work_orders(id), -- linked once converted into actionable work
  resolved_at timestamptz
);

create table complaint_photos (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create index idx_complaints_property on complaints(property_id);
create index idx_complaints_status on complaints(status);

-- Notification queue: every complaint submission + SLA breach generates a row here,
-- consumed by a push-notification worker (FCM/APNs) to alert the on-duty technician.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references user_profiles(id),
  type text not null check (type in ('complaint_new','complaint_sla_breach','work_order_assigned','approval_pending','approval_escalated')),
  entity_type text not null,
  entity_id uuid not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── 3. Full apartment / building / occupancy model ───────────────────
-- Extend units with physical detail; add leasing + occupants so the platform
-- knows exactly who lives where, how many people, and for how long.

alter table units
  add column floor text,
  add column bedrooms int,
  add column bathrooms int,
  add column size_sqm numeric(8,2),
  add column max_occupancy int;

create table leases (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  primary_resident_id uuid references user_profiles(id),
  tenant_full_name text not null, -- captured even if resident has no app login yet
  start_date date not null,
  end_date date,
  occupant_count int not null default 1,
  status text not null default 'active' check (status in ('active','ended','terminated','pending')),
  created_at timestamptz not null default now()
);

create table lease_occupants (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases(id) on delete cascade,
  full_name text not null,
  relationship_to_primary text, -- spouse, child, roommate, etc.
  is_primary boolean not null default false
);

create index idx_leases_unit on leases(unit_id);

-- ── RLS for new tenant-scoped tables ──────────────────────────────────
alter table complaints enable row level security;
create policy tenant_isolation_complaints on complaints
  using (tenant_id = current_tenant_id());
