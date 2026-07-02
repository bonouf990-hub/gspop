-- Phase 1 of the Maintenance Chain blueprint: one case, one number, one thread.
-- Every complaint and work order gets a case number (MC-YYYY-NNNN). When a
-- complaint is converted to a work order, the work order inherits the
-- complaint's number so the whole chain shares one reference.

create sequence if not exists maintenance_case_seq;

alter table work_orders add column if not exists case_number text;
alter table complaints add column if not exists case_number text;
alter table complaints add column if not exists asset_id uuid references assets(id);

create index if not exists idx_work_orders_case_number on work_orders(case_number);
create index if not exists idx_complaints_case_number on complaints(case_number);

create or replace function next_case_number() returns text as $$
  select 'MC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('maintenance_case_seq')::text, 4, '0');
$$ language sql;

-- New work orders get a case number automatically
create or replace function assign_wo_case_number() returns trigger as $$
begin
  if new.case_number is null then
    new.case_number := next_case_number();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_wo_case_number on work_orders;
create trigger trg_wo_case_number
  before insert on work_orders
  for each row execute function assign_wo_case_number();

-- New complaints get a case number automatically
create or replace function assign_complaint_case_number() returns trigger as $$
begin
  if new.case_number is null then
    new.case_number := next_case_number();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_complaint_case_number on complaints;
create trigger trg_complaint_case_number
  before insert on complaints
  for each row execute function assign_complaint_case_number();

-- When a complaint is converted to a work order, the work order takes the
-- complaint's case number — one thread, one reference.
create or replace function inherit_case_number_on_convert() returns trigger as $$
begin
  if new.work_order_id is not null
     and (old.work_order_id is distinct from new.work_order_id)
     and new.case_number is not null then
    update work_orders
    set case_number = new.case_number
    where id = new.work_order_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_complaint_case_inherit on complaints;
create trigger trg_complaint_case_inherit
  after update on complaints
  for each row execute function inherit_case_number_on_convert();

-- ── Backfill existing records, oldest first ─────────────────────────────────
do $$
declare
  r record;
begin
  -- Complaints first (they are the origin of converted cases)
  for r in select id from complaints where case_number is null order by created_at
  loop
    update complaints set case_number = next_case_number() where id = r.id;
  end loop;

  -- Converted work orders inherit their complaint's number
  update work_orders wo
  set case_number = c.case_number
  from complaints c
  where c.work_order_id = wo.id
    and wo.case_number is null
    and c.case_number is not null;

  -- Remaining work orders get their own numbers
  for r in select id from work_orders where case_number is null order by created_at
  loop
    update work_orders set case_number = next_case_number() where id = r.id;
  end loop;
end $$;
