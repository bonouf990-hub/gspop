-- GSPOP: Automation — scheduled jobs that make the platform run itself.
-- 1. Preventive maintenance auto-generates work orders when due.
-- 2. Daily rent-overdue and lease-expiry sweeps (functions from 0037).
-- 3. A webhook heartbeat that triggers external notification delivery
--    (email/WhatsApp) via the ops-console dispatch endpoint.
--
-- Requires the pg_cron and pg_net extensions (available on Supabase).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Track external delivery so the dispatcher never sends twice.
alter table notifications add column if not exists dispatched_at timestamptz;
create index if not exists idx_notifications_undispatched
  on notifications(created_at) where dispatched_at is null;

-- Server-side config the cron jobs read (dispatch URL + shared secret).
-- Locked down: no RLS policies means only service role / definer functions
-- can touch it.
create table if not exists app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_config enable row level security;

-- ── 1. Preventive maintenance: generate due work orders ───────────────────
create or replace function generate_pm_work_orders() returns int as $$
declare
  s record;
  generated int := 0;
begin
  for s in
    select * from maintenance_schedules
    where is_active and next_due_date <= current_date
  loop
    insert into work_orders (
      tenant_id, property_id, unit_id, asset_id,
      type, priority, status, title, description,
      created_by, assigned_technician_id, trade, maintenance_schedule_id
    ) values (
      s.tenant_id, s.property_id, s.unit_id, s.asset_id,
      case when s.type = 'certification' then 'inspection' else s.type end,
      s.priority,
      case when s.assigned_technician_id is not null then 'assigned' else 'approved' end,
      s.title,
      coalesce(s.description, '') ||
        e'\n\n[Auto-generated from preventive maintenance schedule — due ' || s.next_due_date || ']',
      s.created_by, s.assigned_technician_id, s.trade, s.id
    );

    update maintenance_schedules
    set last_generated_at = now(),
        next_due_date = s.next_due_date + case s.frequency
          when 'daily' then interval '1 day'
          when 'weekly' then interval '7 days'
          when 'biweekly' then interval '14 days'
          when 'monthly' then interval '1 month'
          when 'quarterly' then interval '3 months'
          when 'biannual' then interval '6 months'
          else interval '1 year'
        end
    where id = s.id;

    generated := generated + 1;
  end loop;

  return generated;
end;
$$ language plpgsql security definer set search_path = public;

-- ── 2. Daily sweep: rent, leases, preventive maintenance ──────────────────
create or replace function run_daily_automation() returns void as $$
begin
  perform notify_overdue_rent();
  perform notify_expiring_leases();
  perform generate_pm_work_orders();
end;
$$ language plpgsql security definer set search_path = public;

-- ── 3. Notification delivery heartbeat ─────────────────────────────────────
-- Calls the ops-console /api/notifications/dispatch endpoint, which sends
-- email/WhatsApp for undelivered notifications. No-op until app_config has
-- notify_dispatch_url + notify_dispatch_secret.
create or replace function dispatch_notifications_webhook() returns void as $$
declare
  cfg_url text;
  cfg_secret text;
begin
  select value into cfg_url from app_config where key = 'notify_dispatch_url';
  select value into cfg_secret from app_config where key = 'notify_dispatch_secret';
  if cfg_url is null or cfg_secret is null then
    return;
  end if;
  perform net.http_post(
    url := cfg_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cfg_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ── Schedule the jobs (idempotent: unschedule first if they exist) ────────
do $$
begin
  begin
    perform cron.unschedule('gspop-daily-automation');
  exception when others then null;
  end;
  begin
    perform cron.unschedule('gspop-notify-dispatch');
  exception when others then null;
  end;

  -- 04:00 UTC = 08:00 UAE, every day
  perform cron.schedule('gspop-daily-automation', '0 4 * * *', 'select run_daily_automation()');
  -- every 15 minutes
  perform cron.schedule('gspop-notify-dispatch', '*/15 * * * *', 'select dispatch_notifications_webhook()');
end $$;
