-- AMC / warranty guard: let a contract (AMC) be pinned to a building and a
-- system, so the app can tell — at the point of charging a repair — whether
-- the equipment is already covered and by whom.

alter table contracts add column if not exists property_id uuid references properties(id) on delete set null;
alter table contracts add column if not exists covered_system text; -- e.g. 'hvac', 'elevator', 'firefighting', or 'general'

create index if not exists idx_contracts_property on contracts(property_id);
create index if not exists idx_contracts_end_date on contracts(end_date);
