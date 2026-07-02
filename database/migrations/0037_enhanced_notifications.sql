-- Enhanced notification triggers for work order lifecycle, visit booking, and lease expiry.

-- Expand allowed types on the tenant-portal notifications table (original from 0002).
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'complaint_new','complaint_sla_breach','complaint_status_update',
    'work_order_assigned','work_order_status_update','work_order_completed',
    'approval_pending','approval_escalated',
    'notice_posted','rent_cleared','rent_overdue',
    'visit_booked','visit_confirmed','visit_cancelled',
    'lease_expiry_warning','lease_renewed',
    'visitor_invited','visitor_arrived','visitor_declined'
  ));

-- 1. Work order status change → notify assigned technician + creator
create or replace function notify_work_order_status_change() returns trigger as $$
begin
  -- Notify assigned technician
  if new.assigned_technician_id is not null and new.assigned_technician_id != coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into notifications (recipient_id, type, entity_type, entity_id, message)
    values (
      new.assigned_technician_id,
      case
        when new.status in ('completed_by_technician','verified_by_supervisor','confirmed_by_resident','closed') then 'work_order_completed'
        when new.status = 'assigned' then 'work_order_assigned'
        else 'work_order_status_update'
      end,
      'work_order',
      new.id,
      'Work order "' || new.title || '" is now ' || replace(new.status, '_', ' ') || '.'
    );
  end if;

  -- Notify the resident if the work order has a resident_id (visit bookings)
  if new.resident_id is not null then
    insert into notifications (recipient_id, type, entity_type, entity_id, message)
    values (
      new.resident_id,
      case
        when new.status = 'assigned' then 'visit_confirmed'
        when new.status = 'cancelled' then 'visit_cancelled'
        when new.status in ('completed_by_technician','verified_by_supervisor','closed') then 'work_order_completed'
        else 'work_order_status_update'
      end,
      'work_order',
      new.id,
      case
        when new.status = 'assigned' then 'Your visit request "' || new.title || '" has been confirmed and a technician assigned.'
        when new.status = 'cancelled' then 'Your visit request "' || new.title || '" has been cancelled.'
        when new.status in ('completed_by_technician','verified_by_supervisor','closed') then 'Your visit request "' || new.title || '" has been completed.'
        else 'Your request "' || new.title || '" is now ' || replace(new.status, '_', ' ') || '.'
      end
    );
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_work_order_status_notify on work_orders;
create trigger trg_work_order_status_notify
  after update on work_orders
  for each row
  when (old.status is distinct from new.status)
  execute function notify_work_order_status_change();

-- 2. New visit booking created → notify management
create or replace function notify_visit_booked() returns trigger as $$
begin
  if new.visit_source = 'resident_booking' then
    -- Notify all property managers and supervisors for this property
    insert into notifications (recipient_id, type, entity_type, entity_id, message)
    select up.id, 'visit_booked', 'work_order', new.id,
           'New visit request: "' || new.title || '" for ' || coalesce(new.preferred_visit_date::text, 'TBD')
    from user_profiles up
    where up.tenant_id = new.tenant_id
      and up.role in ('tenant_admin', 'property_manager', 'supervisor')
      and up.id != coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_visit_booked_notify on work_orders;
create trigger trg_visit_booked_notify
  after insert on work_orders
  for each row
  execute function notify_visit_booked();

-- 3. Rent overdue → auto-notify resident (called by a scheduled job or manual trigger)
create or replace function notify_overdue_rent() returns void as $$
begin
  -- Mark invoices as overdue
  update rent_invoices
  set status = 'overdue'
  where status = 'pending'
    and due_date < current_date;

  -- Notify residents with overdue invoices
  insert into notifications (recipient_id, type, entity_type, entity_id, message)
  select l.primary_resident_id, 'rent_overdue', 'rent_invoice', ri.id,
         'Rent payment of ' || ri.amount || ' AED was due on ' || ri.due_date || '. Please arrange payment.'
  from rent_invoices ri
  join leases l on l.id = ri.lease_id
  where ri.status = 'overdue'
    and l.primary_resident_id is not null
    and not exists (
      select 1 from notifications n
      where n.recipient_id = l.primary_resident_id
        and n.entity_id = ri.id
        and n.type = 'rent_overdue'
        and n.created_at > current_date - interval '7 days'
    );
end;
$$ language plpgsql security definer set search_path = public;

-- 4. Lease expiry warning function (called by scheduled job or manual trigger)
create or replace function notify_expiring_leases() returns void as $$
begin
  -- 60-day warning
  insert into notifications (recipient_id, type, entity_type, entity_id, message)
  select l.primary_resident_id, 'lease_expiry_warning', 'lease', l.id,
         'Your lease expires on ' || l.end_date || '. Please contact management to discuss renewal.'
  from leases l
  where l.status = 'active'
    and l.end_date is not null
    and l.end_date between current_date and current_date + interval '60 days'
    and l.primary_resident_id is not null
    and not exists (
      select 1 from notifications n
      where n.recipient_id = l.primary_resident_id
        and n.entity_id = l.id
        and n.type = 'lease_expiry_warning'
        and n.created_at > current_date - interval '30 days'
    );

  -- Also notify management about expiring leases
  insert into notifications (recipient_id, type, entity_type, entity_id, message)
  select up.id, 'lease_expiry_warning', 'lease', l.id,
         'Lease for ' || l.tenant_full_name || ' expires on ' || l.end_date || '.'
  from leases l
  join units u on u.id = l.unit_id
  join properties p on p.id = u.property_id
  cross join user_profiles up
  where l.status = 'active'
    and l.end_date is not null
    and l.end_date between current_date and current_date + interval '60 days'
    and up.tenant_id = p.tenant_id
    and up.role in ('tenant_admin', 'property_manager')
    and not exists (
      select 1 from notifications n
      where n.recipient_id = up.id
        and n.entity_id = l.id
        and n.type = 'lease_expiry_warning'
        and n.created_at > current_date - interval '30 days'
    );
end;
$$ language plpgsql security definer set search_path = public;
