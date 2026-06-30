-- GSPOP: Trade-based operations monitor — open case counts and
-- technician utilization (busy vs idle) per trade (HVAC, plumbing,
-- carpentry, electrical, general), the back-end control layer for staffing
-- and accountability.

-- ── 1. Classify technicians and work orders by trade ────────────────────
alter table user_profiles
  add column trade text check (trade in ('hvac','plumbing','carpentry','electrical','general'));

alter table work_orders
  add column trade text check (trade in ('hvac','plumbing','carpentry','electrical','general'));

-- ── 2. Open case counts per trade ────────────────────────────────────────
create view trade_case_counts as
select
  coalesce(trade, 'general') as trade,
  count(*) filter (where status not in ('closed', 'cancelled', 'confirmed_by_resident')) as open_cases,
  count(*) filter (where status = 'pending_approval') as pending_approval,
  count(*) filter (where status in ('assigned', 'in_progress', 'paused')) as active_cases,
  count(*) as total_cases
from work_orders
group by coalesce(trade, 'general');

-- ── 3. Technician utilization per trade: busy vs idle right now ─────────
create view trade_technician_utilization as
select
  coalesce(up.trade, 'general') as trade,
  count(up.id) as total_technicians,
  count(up.id) filter (where wo_active.technician_id is not null) as busy_technicians,
  count(up.id) filter (where wo_active.technician_id is null) as idle_technicians,
  round(
    100.0 * count(up.id) filter (where wo_active.technician_id is not null)
    / nullif(count(up.id), 0), 1
  ) as utilization_pct
from user_profiles up
left join (
  select distinct assigned_technician_id as technician_id
  from work_orders
  where status in ('assigned', 'in_progress', 'paused')
) wo_active on wo_active.technician_id = up.id
where up.role = 'technician'
group by coalesce(up.trade, 'general');

-- ── 4. Per-technician current status (for drill-down) ───────────────────
create view technician_current_status as
select
  up.id as technician_id,
  up.full_name,
  coalesce(up.trade, 'general') as trade,
  case when wo.id is not null then 'busy' else 'idle' end as status,
  wo.id as current_work_order_id,
  wo.title as current_work_order_title
from user_profiles up
left join lateral (
  select id, title from work_orders
  where assigned_technician_id = up.id
  and status in ('assigned', 'in_progress', 'paused')
  order by created_at desc
  limit 1
) wo on true
where up.role = 'technician';

-- Classify the seeded test technician and work order as HVAC.
update user_profiles set trade = 'hvac' where role = 'technician' and full_name = 'Test Technician';
update work_orders set trade = 'hvac' where title = 'AC not cooling';
