-- GSPOP: Sub-issues per complaint category, backend-managed (same pattern
-- as complaint_categories) so "AC Problem" expands into specific options
-- like "Not cooling" / "Making noise" / "Remote not working".

create table complaint_subissues (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references complaint_categories(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true
);

create index idx_complaint_subissues_category on complaint_subissues(category_id, active);

alter table complaints
  add column subissue_id uuid references complaint_subissues(id);

alter table complaint_subissues enable row level security;
create policy tenant_isolation_complaint_subissues on complaint_subissues
  using (category_id in (select id from complaint_categories where tenant_id = current_tenant_id()));

-- Seed sub-issues for each category on the test tenant.
insert into complaint_subissues (category_id, name, sort_order)
select cc.id, sub.name, sub.ord
from complaint_categories cc
join tenants t on t.id = cc.tenant_id and t.name = 'Golden Sands (Test)'
cross join lateral (
  values
    ('AC Problem', 'Not cooling', 1),
    ('AC Problem', 'Not heating', 2),
    ('AC Problem', 'Making noise', 3),
    ('AC Problem', 'Water leaking', 4),
    ('AC Problem', 'Remote not working', 5),
    ('AC Problem', 'Other', 6),
    ('Lights Not Working', 'Bulb not working', 1),
    ('Lights Not Working', 'Switch not working', 2),
    ('Lights Not Working', 'Flickering', 3),
    ('Lights Not Working', 'Other', 4),
    ('Heater Not Working', 'Not heating', 1),
    ('Heater Not Working', 'Making noise', 2),
    ('Heater Not Working', 'Other', 3),
    ('Door Lock Issue', 'Key not working', 1),
    ('Door Lock Issue', 'Lock jammed', 2),
    ('Door Lock Issue', 'Smart lock battery', 3),
    ('Door Lock Issue', 'Other', 4),
    ('Plumbing / Water Leak', 'Leaking pipe', 1),
    ('Plumbing / Water Leak', 'Low water pressure', 2),
    ('Plumbing / Water Leak', 'Clogged drain', 3),
    ('Plumbing / Water Leak', 'No hot water', 4),
    ('Plumbing / Water Leak', 'Other', 5),
    ('Internet / TV', 'No internet', 1),
    ('Internet / TV', 'Slow internet', 2),
    ('Internet / TV', 'TV not working', 3),
    ('Internet / TV', 'Other', 4),
    ('Pest Control', 'Insects', 1),
    ('Pest Control', 'Rodents', 2),
    ('Pest Control', 'Other', 3),
    ('Cleaning Request', 'Common area', 1),
    ('Cleaning Request', 'Unit deep clean', 2),
    ('Cleaning Request', 'Other', 3),
    ('Noise Complaint', 'Neighbor', 1),
    ('Noise Complaint', 'Construction', 2),
    ('Noise Complaint', 'Other', 3),
    ('Other', 'General', 1)
) as sub(category_name, name, ord)
where cc.name = sub.category_name;
