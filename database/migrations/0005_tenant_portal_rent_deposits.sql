-- GSPOP: Tenant portal foundation — rent/invoicing, security deposits,
-- move-in/move-out checklists, parking, building notices, and row-level
-- security so a resident can only ever see their own apartment.

-- ── 1. Rent terms + security deposit on the lease ──────────────────────
alter table leases
  add column rent_amount numeric(12,2),
  add column rent_frequency text check (rent_frequency in ('monthly','quarterly','yearly')),
  add column deposit_amount numeric(12,2),
  add column deposit_status text not null default 'held' check (deposit_status in ('held','partially_refunded','refunded','forfeited')),
  add column parking_space_label text;

-- ── 2. Rent invoices + payments ─────────────────────────────────────────
create table rent_invoices (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases(id) on delete cascade,
  amount numeric(12,2) not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','paid','overdue','waived')),
  paid_at timestamptz,
  payment_method text,
  created_at timestamptz not null default now()
);

create index idx_rent_invoices_lease on rent_invoices(lease_id);
create index idx_rent_invoices_due on rent_invoices(due_date) where status = 'pending';

-- ── 3. Move-in / move-out condition checklist ───────────────────────────
create table move_checklists (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases(id) on delete cascade,
  checklist_type text not null check (checklist_type in ('move_in','move_out')),
  performed_by uuid not null references user_profiles(id),
  performed_at timestamptz not null default now(),
  notes text
);

create table move_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references move_checklists(id) on delete cascade,
  item_name text not null,         -- "Living room walls", "AC unit", "Washing machine"
  condition text not null check (condition in ('good','fair','damaged','missing')),
  photo_path text,
  notes text
);

-- ── 4. Building-wide notices/announcements ──────────────────────────────
create table building_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  title text not null,
  body text not null,
  posted_by uuid not null references user_profiles(id),
  posted_at timestamptz not null default now(),
  expires_at timestamptz
);

create index idx_building_notices_property on building_notices(property_id, posted_at desc);

-- ── 5. Row-level security: a resident sees only their own data ─────────
-- Residents authenticate as a normal user_profiles row with role='resident'.
-- These policies restrict reads to rows tied to that resident's own lease/unit.

alter table leases enable row level security;
alter table rent_invoices enable row level security;
alter table move_checklists enable row level security;
alter table building_notices enable row level security;

create or replace function is_resident() returns boolean as $$
  select role = 'resident' from user_profiles where id = auth.uid();
$$ language sql stable;

create policy resident_own_lease on leases
  for select using (
    not is_resident() or primary_resident_id = auth.uid()
  );

create policy resident_own_invoices on rent_invoices
  for select using (
    not is_resident()
    or lease_id in (select id from leases where primary_resident_id = auth.uid())
  );

create policy resident_own_checklists on move_checklists
  for select using (
    not is_resident()
    or lease_id in (select id from leases where primary_resident_id = auth.uid())
  );

create policy resident_building_notices on building_notices
  for select using (
    not is_resident()
    or property_id in (
      select u.property_id from leases l
      join units u on u.id = l.unit_id
      where l.primary_resident_id = auth.uid()
    )
  );

-- Residents already had a broad complaints policy missing role-scoping; tighten it
-- so a resident only ever sees their own submitted complaints.
drop policy if exists tenant_isolation_complaints on complaints;
create policy tenant_isolation_complaints on complaints
  using (
    tenant_id = current_tenant_id()
    and (not is_resident() or resident_id = auth.uid())
  );
