-- AMFM Step 1: Asset Register enrichment.
-- The assets table already carries lifecycle, condition, QR/RFID, status and
-- maintenance-cycle fields. This adds the register attributes the AMFM
-- document asks for: identity (make/model/serial), warranty tracking,
-- building-system classification, and criticality — so every piece of
-- equipment has a complete file at Building > Floor > Apartment/Common > Equipment.

alter table assets add column if not exists manufacturer text;
alter table assets add column if not exists model text;
alter table assets add column if not exists serial_number text;
alter table assets add column if not exists warranty_expiry date;
alter table assets add column if not exists warranty_provider text;
alter table assets add column if not exists purchase_cost numeric(14,2);
alter table assets add column if not exists criticality text
  check (criticality in ('critical','high','medium','low'));
alter table assets add column if not exists system_type text
  check (system_type in (
    'hvac','electrical','plumbing','fire_alarm','firefighting',
    'elevator','water_tank','pump','generator','bms','other'
  ));

-- Condition assessments over time (module 1: "Asset condition assessments").
create table if not exists asset_condition_assessments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  condition text not null check (condition in ('new','refurbished','used','damaged')),
  score int check (score between 1 and 5),
  notes text,
  assessed_by uuid references user_profiles(id),
  assessed_at timestamptz not null default now()
);

create index if not exists idx_asset_assessments_asset on asset_condition_assessments(asset_id);

alter table asset_condition_assessments enable row level security;
drop policy if exists tenant_isolation_asset_assessments on asset_condition_assessments;
create policy tenant_isolation_asset_assessments on asset_condition_assessments
  for all using (
    asset_id in (
      select id from assets where property_id in (
        select id from properties where tenant_id = current_tenant_id()
      )
    )
  );

-- Helpful indexes for the register views.
create index if not exists idx_assets_property on assets(property_id);
create index if not exists idx_assets_unit on assets(unit_id);
create index if not exists idx_assets_system_type on assets(system_type);
create index if not exists idx_assets_warranty on assets(warranty_expiry) where warranty_expiry is not null;
