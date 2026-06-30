-- GSPOP: Visitor management, access/key control, preventive-maintenance
-- scheduling, utility metering, compliance/document expiry, common-area
-- bookings, and budget/cost-center tracking.

-- ── 1. Visitor management ─────────────────────────────────────────────
create table visitors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  full_name text not null,
  id_photo_path text,           -- captured ID/face photo at entry
  purpose text not null check (purpose in ('guest','delivery','contractor','vendor','inspection','other')),
  host_resident_id uuid references user_profiles(id),  -- who they are visiting
  hosted_by_approved boolean not null default false,    -- resident pre-approved entry
  checked_in_at timestamptz,
  checked_in_by uuid references user_profiles(id),       -- security/concierge who logged entry
  checked_out_at timestamptz,
  vehicle_plate text,
  created_at timestamptz not null default now()
);

create index idx_visitors_property on visitors(property_id);
create index idx_visitors_unit on visitors(unit_id);

-- ── 2. Access / key card control ──────────────────────────────────────
create table access_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  credential_type text not null check (credential_type in ('physical_key','key_card','fob','mobile_credential','code')),
  credential_label text not null,    -- e.g. serial number / card ID
  assigned_to uuid references user_profiles(id),
  unit_id uuid references units(id) on delete set null,
  common_area_id uuid references common_areas(id) on delete set null,
  status text not null default 'issued' check (status in ('issued','returned','lost','revoked','disabled')),
  issued_at timestamptz not null default now(),
  issued_by uuid not null references user_profiles(id),
  returned_at timestamptz,
  notes text
);

create table access_events (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references access_credentials(id) on delete cascade,
  event_type text not null check (event_type in ('entry','exit','denied','door_forced')),
  door_or_location text not null,
  occurred_at timestamptz not null default now()
);

create index idx_access_credentials_assigned on access_credentials(assigned_to);
create index idx_access_events_credential on access_events(credential_id);

-- ── 3. Preventive maintenance scheduler ───────────────────────────────
-- Holds the recurring schedule itself; a background job reads due rows and
-- auto-creates a work_order, rather than relying on a date sitting unused
-- on the asset.
create table maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  frequency_months int not null,
  last_generated_at date,
  next_due_date date not null,
  checklist text,                 -- standard steps/checklist for this PM job
  auto_assign_technician_id uuid references user_profiles(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_maintenance_schedules_due on maintenance_schedules(next_due_date) where active;

-- ── 4. Utility meter tracking ──────────────────────────────────────────
create table utility_meters (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,    -- null = building-level meter
  meter_type text not null check (meter_type in ('electricity','water','gas','chilled_water','other')),
  meter_number text not null,
  installed_at date
);

create table utility_readings (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references utility_meters(id) on delete cascade,
  reading_value numeric(14,3) not null,
  reading_date date not null,
  recorded_by uuid references user_profiles(id),
  is_anomalous boolean not null default false,  -- flagged when jump vs. trailing average exceeds threshold
  created_at timestamptz not null default now()
);

create index idx_utility_readings_meter on utility_readings(meter_id, reading_date);

-- ── 5. Compliance / document expiry tracking ───────────────────────────
create table compliance_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete cascade,
  document_type text not null check (document_type in (
    'fire_safety_certificate','elevator_inspection','insurance_policy',
    'vendor_license','trade_license','warranty','other'
  )),
  title text not null,
  storage_path text,
  issued_date date,
  expiry_date date not null,
  reminder_days_before int not null default 30,
  status text not null default 'valid' check (status in ('valid','expiring_soon','expired')),
  created_at timestamptz not null default now()
);

create index idx_compliance_documents_expiry on compliance_documents(expiry_date);

-- ── 6. Common-area bookings (gym, pool, function room) ─────────────────
create table common_area_bookings (
  id uuid primary key default gen_random_uuid(),
  common_area_id uuid not null references common_areas(id) on delete cascade,
  resident_id uuid not null references user_profiles(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled','no_show')),
  created_at timestamptz not null default now()
);

create index idx_common_area_bookings_area on common_area_bookings(common_area_id, start_time);

-- ── 7. Budget / cost-center tracking ────────────────────────────────────
create table budgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  category text not null check (category in ('maintenance','utilities','purchasing','staffing','other')),
  fiscal_year int not null,
  fiscal_month int not null check (fiscal_month between 1 and 12),
  budgeted_amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (property_id, category, fiscal_year, fiscal_month)
);

-- Actual-vs-budget rollup, sourced from work orders and purchase orders.
create view budget_actuals as
select
  b.id as budget_id,
  b.property_id,
  b.category,
  b.fiscal_year,
  b.fiscal_month,
  b.budgeted_amount,
  coalesce(sum(wo.actual_cost) filter (
    where b.category = 'maintenance'
      and extract(year from wo.created_at) = b.fiscal_year
      and extract(month from wo.created_at) = b.fiscal_month
  ), 0)
  + coalesce(sum(po.amount) filter (
    where b.category = 'purchasing'
      and extract(year from po.created_at) = b.fiscal_year
      and extract(month from po.created_at) = b.fiscal_month
  ), 0) as actual_amount
from budgets b
left join work_orders wo on wo.property_id = b.property_id
left join purchase_orders po on po.property_id = b.property_id
group by b.id, b.property_id, b.category, b.fiscal_year, b.fiscal_month, b.budgeted_amount;

-- ── RLS for new tenant-scoped tables ──────────────────────────────────
alter table visitors enable row level security;
alter table access_credentials enable row level security;
alter table compliance_documents enable row level security;
alter table budgets enable row level security;

create policy tenant_isolation_visitors on visitors using (tenant_id = current_tenant_id());
create policy tenant_isolation_access_credentials on access_credentials using (tenant_id = current_tenant_id());
create policy tenant_isolation_compliance_documents on compliance_documents using (tenant_id = current_tenant_id());
create policy tenant_isolation_budgets on budgets using (tenant_id = current_tenant_id());
