-- AMFM: capture each asset's pre-existing service history and cost, and allow
-- logging individual historical service records — so equipment loaded into the
-- register carries its real past (times serviced + money spent), not just
-- what happens after go-live.

-- Quick totals for prior (pre-system) history — bulk-loadable and editable.
alter table assets add column if not exists prior_service_count int default 0;
alter table assets add column if not exists prior_service_cost numeric(14,2) default 0;

-- Detailed historical service log (services done before or outside the system).
create table if not exists asset_service_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  service_date date,
  description text,
  cost numeric(14,2),
  vendor_name text,
  logged_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_asset_service_history_asset on asset_service_history(asset_id);

alter table asset_service_history enable row level security;
drop policy if exists tenant_isolation_asset_service_history on asset_service_history;
create policy tenant_isolation_asset_service_history on asset_service_history
  for all using (
    asset_id in (
      select id from assets where property_id in (
        select id from properties where tenant_id = current_tenant_id()
      )
    )
  );
