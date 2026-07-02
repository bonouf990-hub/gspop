-- Annual maintenance budget per building
create table building_budgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  fiscal_year int not null,
  total_budget numeric(14,2) not null default 0,
  notes text,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, property_id, fiscal_year)
);

alter table building_budgets enable row level security;
create policy tenant_isolation_building_budgets on building_budgets
  using (tenant_id = current_tenant_id());
