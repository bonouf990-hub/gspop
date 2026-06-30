-- GSPOP: Common/public areas as first-class locations, and complaint-to-asset
-- linkage so recurring problems on the same equipment can be detected.

-- ── 1. Common / public areas ──────────────────────────────────────────
-- Lobby, basement, parking, corridors, pool, gym, rooftop, electrical room, etc.
-- These are building-level locations that are NOT a rentable unit, but still
-- hold assets (generators, pumps, elevators, fire systems) and can receive
-- complaints/work orders just like a unit.

create table common_areas (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,            -- "Basement Parking", "Rooftop Plant Room"
  category text not null check (category in (
    'lobby','basement','parking','corridor','elevator','staircase','rooftop',
    'pool','gym','electrical_room','pump_room','fire_system','garden','waste_area','other'
  )),
  floor text,
  notes text,
  created_at timestamptz not null default now()
);

-- Assets and complaints can now belong to a unit OR a common area (never both).
alter table assets
  add column common_area_id uuid references common_areas(id) on delete set null,
  add constraint assets_location_check check (
    not (unit_id is not null and common_area_id is not null)
  );

alter table complaints
  add column common_area_id uuid references common_areas(id) on delete set null,
  add column asset_id uuid references assets(id) on delete set null,
  add constraint complaints_location_check check (
    not (unit_id is not null and common_area_id is not null)
  );

alter table work_orders
  add column common_area_id uuid references common_areas(id) on delete set null;

create index idx_common_areas_property on common_areas(property_id);
create index idx_complaints_asset on complaints(asset_id);

-- ── 2. Recurring-problem detection (the "AI memory" data layer) ───────
-- This view surfaces, per asset, how many corrective work orders and
-- complaints have hit it and when — the raw signal an AI/recommendation
-- layer (or a simple threshold rule) uses to flag "this AC has had its
-- compressor replaced 3 times, something else is wrong."

create view asset_issue_history as
select
  a.id as asset_id,
  a.name as asset_name,
  a.property_id,
  a.unit_id,
  a.common_area_id,
  count(distinct wo.id) filter (where wo.type = 'corrective') as corrective_work_order_count,
  count(distinct c.id) as complaint_count,
  max(wo.created_at) as last_work_order_at,
  max(c.submitted_at) as last_complaint_at,
  (count(distinct wo.id) filter (where wo.type = 'corrective') >= 3) as is_recurring_issue
from assets a
left join work_orders wo on wo.asset_id = a.id
left join complaints c on c.asset_id = a.id
group by a.id, a.name, a.property_id, a.unit_id, a.common_area_id;

-- Full context for a complaint: who reported it, where, and what history
-- exists for that specific asset and that specific unit -- this is what
-- powers the "last time we did the AC job too" popup when a technician
-- opens a new complaint.
create view complaint_context as
select
  c.id as complaint_id,
  c.title,
  c.description,
  c.status,
  c.submitted_at,
  c.asset_id,
  c.unit_id,
  c.common_area_id,
  u.label as unit_label,
  l.tenant_full_name as resident_name,
  l.occupant_count,
  l.start_date as lease_start_date,
  l.end_date as lease_end_date,
  aih.asset_name,
  aih.corrective_work_order_count,
  aih.complaint_count as prior_complaint_count_on_asset,
  aih.last_work_order_at as last_work_order_on_asset_at,
  aih.is_recurring_issue
from complaints c
left join units u on u.id = c.unit_id
left join leases l on l.unit_id = c.unit_id and l.status = 'active'
left join asset_issue_history aih on aih.asset_id = c.asset_id;

alter table common_areas enable row level security;
create policy tenant_isolation_common_areas on common_areas
  using (property_id in (select id from properties where tenant_id = current_tenant_id()));
