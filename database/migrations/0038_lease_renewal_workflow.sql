-- Lease renewal tracking and workflow.

-- Add renewal tracking columns to leases.
alter table leases
  add column if not exists renewal_status text
    check (renewal_status in ('not_started','notice_sent','negotiating','renewed','not_renewing','expired')),
  add column if not exists renewal_notice_sent_at timestamptz,
  add column if not exists renewal_decision_at timestamptz,
  add column if not exists renewed_lease_id uuid references leases(id),
  add column if not exists renewal_notes text;

-- Default existing active leases with end dates.
update leases set renewal_status = 'not_started'
  where renewal_status is null and status = 'active';

-- Add storekeeper role to user_profiles constraint if not already there.
-- (Migration 0016 added call_center, but storekeeper was missing from the check.)
alter table user_profiles drop constraint if exists user_profiles_role_check;
alter table user_profiles add constraint user_profiles_role_check
  check (role in (
    'super_admin','tenant_admin','property_manager','supervisor',
    'technician','vendor','resident','security','call_center','storekeeper'
  ));
