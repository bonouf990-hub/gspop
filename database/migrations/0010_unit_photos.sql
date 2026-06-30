-- GSPOP: Apartment photos, so the tenant portal can show a real photo of
-- the resident's own unit on their home screen instead of a generic icon.

create table unit_photos (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  storage_path text not null,
  is_primary boolean not null default false,
  caption text,
  uploaded_at timestamptz not null default now()
);

create index idx_unit_photos_unit on unit_photos(unit_id);

alter table unit_photos enable row level security;
create policy tenant_isolation_unit_photos on unit_photos
  using (unit_id in (
    select id from units where property_id in (select id from properties where tenant_id = current_tenant_id())
  ));
