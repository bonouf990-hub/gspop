-- GSPOP: Complete the tenant surface — let managers actually manage rent,
-- notices, and lease documents (the tables were read-only before), track
-- rent as cheques (the agreed contract method, not an online gateway), and
-- fan real events out to residents as in-app notifications.

-- ── 1. Cheque tracking on rent invoices ────────────────────────────────
-- Rent is paid by post-dated cheques held under the tenancy contract. An
-- invoice represents one cheque in the schedule; it's marked paid when the
-- cheque clears. payment_method already exists ('cheque','bank_transfer','cash').
alter table rent_invoices
  add column if not exists cheque_number text,
  add column if not exists cheque_bank text,
  add column if not exists cleared_at timestamptz,
  add column if not exists notes text;

-- ── 2. Managers can write rent invoices + notices (were SELECT-only) ───
-- tenant_admin / property_manager get full write within their own tenant;
-- residents keep their existing read-only policies (permissive OR).
drop policy if exists rent_invoices_staff_write on rent_invoices;
create policy rent_invoices_staff_write on rent_invoices
  for all to authenticated
  using (
    current_user_role() in ('tenant_admin', 'property_manager')
    and lease_id in (
      select l.id from leases l
      join units u on u.id = l.unit_id
      join properties p on p.id = u.property_id
      where p.tenant_id = current_tenant_id()
    )
  )
  with check (
    current_user_role() in ('tenant_admin', 'property_manager')
    and lease_id in (
      select l.id from leases l
      join units u on u.id = l.unit_id
      join properties p on p.id = u.property_id
      where p.tenant_id = current_tenant_id()
    )
  );

drop policy if exists building_notices_staff_write on building_notices;
create policy building_notices_staff_write on building_notices
  for all to authenticated
  using (
    current_user_role() in ('tenant_admin', 'property_manager')
    and property_id in (select id from properties where tenant_id = current_tenant_id())
  )
  with check (
    current_user_role() in ('tenant_admin', 'property_manager')
    and property_id in (select id from properties where tenant_id = current_tenant_id())
  );

-- Managers also need to create leases (onboarding a resident). leases had a
-- SELECT-only policy; add a scoped write policy for admins/managers.
drop policy if exists leases_staff_write on leases;
create policy leases_staff_write on leases
  for all to authenticated
  using (
    current_user_role() in ('tenant_admin', 'property_manager')
    and unit_id in (
      select id from units where property_id in (
        select id from properties where tenant_id = current_tenant_id()
      )
    )
  )
  with check (
    current_user_role() in ('tenant_admin', 'property_manager')
    and unit_id in (
      select id from units where property_id in (
        select id from properties where tenant_id = current_tenant_id()
      )
    )
  );

-- ── 3. Notification types for the events residents care about ──────────
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'complaint_new','complaint_sla_breach','complaint_status_update',
    'work_order_assigned','approval_pending','approval_escalated',
    'notice_posted','rent_cleared'
  ));

-- ── 4. Triggers that create those notifications ────────────────────────
-- SECURITY DEFINER so they can insert regardless of who triggered the change.

-- 4a. Complaint status changes → tell the resident.
create or replace function notify_complaint_status_change() returns trigger as $$
begin
  insert into notifications (recipient_id, type, entity_type, entity_id, message)
  values (
    new.resident_id,
    'complaint_status_update',
    'complaint',
    new.id,
    'Your request "' || new.title || '" is now ' || replace(new.status, '_', ' ') || '.'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_complaint_status_notify on complaints;
create trigger trg_complaint_status_notify
  after update on complaints
  for each row
  when (old.status is distinct from new.status)
  execute function notify_complaint_status_change();

-- 4b. A building notice is posted → tell every active resident on that property.
create or replace function notify_notice_posted() returns trigger as $$
begin
  insert into notifications (recipient_id, type, entity_type, entity_id, message)
  select l.primary_resident_id, 'notice_posted', 'building_notice', new.id,
         'New building notice: ' || new.title
  from leases l
  join units u on u.id = l.unit_id
  where u.property_id = new.property_id
    and l.status = 'active'
    and l.primary_resident_id is not null;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notice_posted_notify on building_notices;
create trigger trg_notice_posted_notify
  after insert on building_notices
  for each row
  execute function notify_notice_posted();

-- 4c. A rent cheque clears → tell the resident.
create or replace function notify_rent_cleared() returns trigger as $$
declare
  resident uuid;
begin
  select primary_resident_id into resident from leases where id = new.lease_id;
  if resident is not null then
    insert into notifications (recipient_id, type, entity_type, entity_id, message)
    values (resident, 'rent_cleared', 'rent_invoice', new.id,
            'Payment of ' || new.amount || ' AED received. Thank you.');
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_rent_cleared_notify on rent_invoices;
create trigger trg_rent_cleared_notify
  after update on rent_invoices
  for each row
  when (old.status is distinct from new.status and new.status = 'paid')
  execute function notify_rent_cleared();

-- ── 5. Lease documents (tenancy contract, Ejari, receipts) ─────────────
create table if not exists lease_documents (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases(id) on delete cascade,
  doc_type text not null check (doc_type in ('lease_agreement','ejari','addendum','receipt','other')),
  title text not null,
  storage_path text not null,
  uploaded_by uuid references user_profiles(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_lease_documents_lease on lease_documents(lease_id);

alter table lease_documents enable row level security;

-- Resident reads their own lease's documents; admins/managers manage them.
drop policy if exists lease_documents_read on lease_documents;
create policy lease_documents_read on lease_documents
  for select using (
    lease_id in (select id from leases where primary_resident_id = auth.uid())
    or (
      current_user_role() in ('tenant_admin', 'property_manager')
      and lease_id in (
        select id from leases where unit_id in (
          select id from units where property_id in (
            select id from properties where tenant_id = current_tenant_id()
          )
        )
      )
    )
  );

drop policy if exists lease_documents_staff_write on lease_documents;
create policy lease_documents_staff_write on lease_documents
  for all to authenticated
  using (
    current_user_role() in ('tenant_admin', 'property_manager')
    and lease_id in (
      select id from leases where unit_id in (
        select id from units where property_id in (
          select id from properties where tenant_id = current_tenant_id()
        )
      )
    )
  )
  with check (
    current_user_role() in ('tenant_admin', 'property_manager')
    and lease_id in (
      select id from leases where unit_id in (
        select id from units where property_id in (
          select id from properties where tenant_id = current_tenant_id()
        )
      )
    )
  );

insert into storage.buckets (id, name, public)
values ('lease-documents', 'lease-documents', false)
on conflict (id) do nothing;

-- Path convention: {leaseId}/{uuid}.{ext}. Resident reads their lease's folder;
-- managers manage documents for leases in their tenant.
drop policy if exists lease_documents_storage_read on storage.objects;
create policy lease_documents_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lease-documents'
    and (storage.foldername(name))[1]::uuid in (
      select id from leases where primary_resident_id = auth.uid()
      union
      select id from leases where
        current_user_role() in ('tenant_admin', 'property_manager')
        and unit_id in (
          select id from units where property_id in (
            select id from properties where tenant_id = current_tenant_id()
          )
        )
    )
  );

drop policy if exists lease_documents_storage_write on storage.objects;
create policy lease_documents_storage_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lease-documents'
    and current_user_role() in ('tenant_admin', 'property_manager')
    and (storage.foldername(name))[1]::uuid in (
      select id from leases where unit_id in (
        select id from units where property_id in (
          select id from properties where tenant_id = current_tenant_id()
        )
      )
    )
  );
