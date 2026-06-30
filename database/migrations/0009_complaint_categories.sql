-- GSPOP: Predefined complaint categories, managed from the backend (not
-- free text), so residents pick from a controlled list (AC problem, lights
-- burnt, heater not working, door lock issue, etc.) and ops can route/report
-- on category consistently.

create table complaint_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  default_priority text not null default 'medium' check (default_priority in ('low','medium','high','emergency')),
  active boolean not null default true,
  sort_order int not null default 0
);

alter table complaints
  add column category_id uuid references complaint_categories(id);

create index idx_complaint_categories_tenant on complaint_categories(tenant_id, active);

alter table complaint_categories enable row level security;
create policy tenant_isolation_complaint_categories on complaint_categories
  using (tenant_id = current_tenant_id());

-- Seed a starter set of categories for the test tenant.
insert into complaint_categories (tenant_id, name, default_priority, sort_order)
select id, name, priority, ord
from tenants
cross join (values
  ('AC Problem', 'high', 1),
  ('Lights Not Working', 'medium', 2),
  ('Heater Not Working', 'high', 3),
  ('Door Lock Issue', 'high', 4),
  ('Plumbing / Water Leak', 'high', 5),
  ('Internet / TV', 'low', 6),
  ('Pest Control', 'medium', 7),
  ('Cleaning Request', 'low', 8),
  ('Noise Complaint', 'medium', 9),
  ('Other', 'medium', 10)
) as cats(name, priority, ord)
where tenants.name = 'Golden Sands (Test)';
