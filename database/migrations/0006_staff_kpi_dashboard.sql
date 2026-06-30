-- GSPOP: Org hierarchy + staff KPI tracking, so a GM can see every level
-- (technician -> supervisor -> head of department -> GM) rated fairly
-- against defined targets, not gut feel.

-- ── 1. Org hierarchy ────────────────────────────────────────────────────
alter table user_profiles
  add column reports_to_id uuid references user_profiles(id),
  add column department text,
  add column job_title text;

create index idx_user_profiles_reports_to on user_profiles(reports_to_id);

-- ── 2. KPI definitions per role ──────────────────────────────────────────
-- Each role has weighted metrics it's measured against (e.g. technician:
-- jobs_completed_on_time weight 40%, avg_supervisor_rating weight 30%,
-- avg_resident_rating weight 30%).
create table kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  role text not null check (role in (
    'technician','supervisor','property_manager','tenant_admin'
  )),
  metric_name text not null,        -- e.g. 'jobs_completed_on_time', 'avg_quality_rating'
  target_value numeric(10,2) not null,
  weight_pct numeric(5,2) not null check (weight_pct between 0 and 100),
  active boolean not null default true
);

-- ── 3. KPI scores — the actual periodic, fair rating ─────────────────────
create table kpi_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  kpi_definition_id uuid not null references kpi_definitions(id),
  period_start date not null,
  period_end date not null,
  actual_value numeric(10,2) not null,
  score_pct numeric(5,2) not null,  -- actual vs target, weighted
  rated_by uuid not null references user_profiles(id),
  rated_at timestamptz not null default now(),
  comments text
);

create index idx_kpi_scores_user_period on kpi_scores(user_id, period_start, period_end);

-- ── 4. Live job/hours/spend stats per technician ─────────────────────────
-- The raw numbers behind the dashboard: job counts by status, hours actually
-- on-site (from GPS check-in/out pairs), spend, and rating averages.
create view technician_job_stats as
select
  up.id as technician_id,
  up.full_name,
  up.department,
  up.reports_to_id,
  count(wo.id) filter (where wo.status in ('assigned','in_progress','paused')) as jobs_in_progress,
  count(wo.id) filter (where wo.status in ('completed_by_technician','verified_by_supervisor','confirmed_by_resident','closed')) as jobs_completed,
  count(wo.id) as jobs_total,
  coalesce(sum(wo.actual_cost), 0) as total_spend,
  coalesce(avg(r.score) filter (where r.rating_type = 'supervisor_quality'), 0) as avg_supervisor_rating,
  coalesce(avg(r.score) filter (where r.rating_type = 'resident_satisfaction'), 0) as avg_resident_rating
from user_profiles up
left join work_orders wo on wo.assigned_technician_id = up.id
left join work_order_ratings r on r.work_order_id = wo.id
where up.role = 'technician'
group by up.id, up.full_name, up.department, up.reports_to_id;

-- Hours actually on-site per work order, derived from paired GPS check-in/out
-- events — this is the anti-misuse-backed source of "hours to finish the job."
create view work_order_hours as
select
  wo.id as work_order_id,
  wo.assigned_technician_id,
  extract(epoch from (
    max(c.timestamp) filter (where c.type = 'check_out')
    - min(c.timestamp) filter (where c.type = 'check_in')
  )) / 3600.0 as hours_on_site
from work_orders wo
join work_order_checkins c on c.work_order_id = wo.id
group by wo.id, wo.assigned_technician_id;

-- Rolls technician hours up to a per-technician total, for the dashboard.
create view technician_hours_summary as
select
  assigned_technician_id as technician_id,
  sum(hours_on_site) as total_hours_logged
from work_order_hours
group by assigned_technician_id;
