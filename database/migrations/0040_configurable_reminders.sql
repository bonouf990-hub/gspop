-- GSPOP: Configurable automation — per-tenant reminder policy.
-- Lease renewal reminders at admin-defined stages (default 90/60/30/10 days
-- before expiry), repeating until the lease renewal is decided. Rent overdue
-- repeat interval and per-automation on/off toggles, plus a UI-changeable
-- daily run hour. Supersedes the fixed 60-day logic from 0037.

-- ── Settings ────────────────────────────────────────────────────────────────
create table if not exists automation_settings (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  lease_reminder_days int[] not null default '{90,60,30,10}',
  rent_overdue_repeat_days int not null default 7,
  enable_lease_reminders boolean not null default true,
  enable_rent_overdue boolean not null default true,
  enable_pm_generation boolean not null default true,
  daily_hour_uae int not null default 8 check (daily_hour_uae between 0 and 23),
  updated_at timestamptz not null default now()
);

alter table automation_settings enable row level security;

drop policy if exists automation_settings_mgmt on automation_settings;
create policy automation_settings_mgmt on automation_settings
  for all using (
    tenant_id = current_tenant_id()
    and current_user_role() in ('super_admin','tenant_admin','property_manager')
  )
  with check (
    tenant_id = current_tenant_id()
    and current_user_role() in ('super_admin','tenant_admin','property_manager')
  );

insert into automation_settings (tenant_id)
select id from tenants
on conflict (tenant_id) do nothing;

-- ── Reminder audit: one row per lease per stage, so each stage fires once ──
create table if not exists lease_renewal_reminders (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases(id) on delete cascade,
  days_threshold int not null,
  sent_at timestamptz not null default now(),
  unique (lease_id, days_threshold)
);

alter table lease_renewal_reminders enable row level security;

drop policy if exists lease_renewal_reminders_mgmt on lease_renewal_reminders;
create policy lease_renewal_reminders_mgmt on lease_renewal_reminders
  for select using (
    current_user_role() in ('super_admin','tenant_admin','property_manager')
    and lease_id in (
      select l.id from leases l
      join units u on u.id = l.unit_id
      join properties p on p.id = u.property_id
      where p.tenant_id = current_tenant_id()
    )
  );

-- ── Lease expiry reminders: staged, repeating, per-tenant policy ────────────
create or replace function notify_expiring_leases() returns void as $$
declare
  t record;
  l record;
  stage int;
begin
  for t in
    select te.id as tenant_id,
           coalesce(s.lease_reminder_days, '{90,60,30,10}'::int[]) as stages,
           coalesce(s.enable_lease_reminders, true) as enabled
    from tenants te
    left join automation_settings s on s.tenant_id = te.id
  loop
    if not t.enabled then
      continue;
    end if;

    for l in
      select le.id, le.tenant_full_name, le.end_date, le.primary_resident_id,
             (le.end_date - current_date) as days_left
      from leases le
      join units u on u.id = le.unit_id
      join properties p on p.id = u.property_id
      where p.tenant_id = t.tenant_id
        and le.status = 'active'
        and le.end_date is not null
        and coalesce(le.renewal_status, 'not_started') not in ('renewed','not_renewing','expired')
        and (le.end_date - current_date) between 0 and (select max(x) from unnest(t.stages) x)
    loop
      -- The smallest configured stage covering days_left that hasn't fired yet.
      select min(x) into stage
      from unnest(t.stages) x
      where x >= l.days_left
        and not exists (
          select 1 from lease_renewal_reminders r
          where r.lease_id = l.id and r.days_threshold = x
        );

      if stage is null then
        continue;
      end if;

      -- Mark this stage and any larger missed stages as covered, so a lease
      -- entering late (e.g. 25 days left) sends ONE reminder, not three.
      insert into lease_renewal_reminders (lease_id, days_threshold)
      select l.id, x from unnest(t.stages) x
      where x >= l.days_left
      on conflict (lease_id, days_threshold) do nothing;

      if l.primary_resident_id is not null then
        insert into notifications (recipient_id, tenant_id, type, title, entity_type, entity_id, message)
        values (
          l.primary_resident_id, t.tenant_id, 'lease_expiry_warning',
          'Lease renewal reminder', 'lease', l.id,
          'Your lease expires on ' || l.end_date || ' — ' || l.days_left ||
          ' days remaining. Please contact management to discuss renewal.'
        );
      end if;

      insert into notifications (recipient_id, tenant_id, type, title, entity_type, entity_id, message)
      select up.id, t.tenant_id, 'lease_expiry_warning',
             'Lease renewal reminder', 'lease', l.id,
             'Lease for ' || l.tenant_full_name || ' expires on ' || l.end_date ||
             ' (' || l.days_left || ' days left — ' || stage || '-day reminder).'
      from user_profiles up
      where up.tenant_id = t.tenant_id
        and up.role in ('tenant_admin','property_manager');
    end loop;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

-- ── Rent overdue: repeat interval from settings ─────────────────────────────
create or replace function notify_overdue_rent() returns void as $$
begin
  update rent_invoices
  set status = 'overdue'
  where status = 'pending'
    and due_date < current_date;

  insert into notifications (recipient_id, tenant_id, type, title, entity_type, entity_id, message)
  select l.primary_resident_id, p.tenant_id, 'rent_overdue', 'Rent overdue', 'rent_invoice', ri.id,
         'Rent payment of ' || ri.amount || ' AED was due on ' || ri.due_date || '. Please arrange payment.'
  from rent_invoices ri
  join leases l on l.id = ri.lease_id
  join units u on u.id = l.unit_id
  join properties p on p.id = u.property_id
  left join automation_settings s on s.tenant_id = p.tenant_id
  where ri.status = 'overdue'
    and coalesce(s.enable_rent_overdue, true)
    and l.primary_resident_id is not null
    and not exists (
      select 1 from notifications n
      where n.recipient_id = l.primary_resident_id
        and n.entity_id = ri.id
        and n.type = 'rent_overdue'
        and n.created_at > now() - make_interval(days => coalesce(s.rent_overdue_repeat_days, 7))
    );
end;
$$ language plpgsql security definer set search_path = public;

-- ── PM generation: honor the toggle ────────────────────────────────────────
create or replace function generate_pm_work_orders() returns int as $$
declare
  s record;
  generated int := 0;
begin
  for s in
    select ms.* from maintenance_schedules ms
    left join automation_settings a on a.tenant_id = ms.tenant_id
    where ms.is_active
      and ms.next_due_date <= current_date
      and coalesce(a.enable_pm_generation, true)
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

-- ── Admin-changeable run time (UAE hours, converted to UTC) ────────────────
create or replace function set_daily_automation_hour(hour_uae int) returns void as $$
declare
  utc_hour int;
begin
  if current_user_role() not in ('super_admin','tenant_admin','property_manager') then
    raise exception 'Not permitted';
  end if;
  if hour_uae < 0 or hour_uae > 23 then
    raise exception 'Hour must be between 0 and 23';
  end if;

  utc_hour := (hour_uae - 4 + 24) % 24;  -- UAE is UTC+4

  begin
    perform cron.unschedule('gspop-daily-automation');
  exception when others then null;
  end;
  perform cron.schedule('gspop-daily-automation', '0 ' || utc_hour || ' * * *', 'select run_daily_automation()');

  update automation_settings set daily_hour_uae = hour_uae, updated_at = now()
  where tenant_id = current_tenant_id();
end;
$$ language plpgsql security definer set search_path = public;
