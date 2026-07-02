-- Site visit step for tenders: vendors must attend site inspection
-- before they can submit a bid. GM schedules visit, vendors register,
-- attendance is tracked, and only attended vendors can submit.

alter table tenders add column site_visit_date timestamptz;
alter table tenders add column site_visit_location text;
alter table tenders add column site_visit_notes text;
alter table tenders add column site_visit_required boolean not null default true;

-- Update status check to include 'site_visit' phase
alter table tenders drop constraint tenders_status_check;
alter table tenders add constraint tenders_status_check
  check (status in (
    'draft','published','site_visit','submissions_open','closed','evaluating','decided','cancelled'
  ));

create table tender_site_visit_registrations (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references tenders(id) on delete cascade,
  vendor_name text not null,
  vendor_email text not null,
  vendor_phone text,
  company_registration text,
  representative_name text not null,
  representative_role text,
  attended boolean not null default false,
  attendance_notes text,
  registered_at timestamptz not null default now(),
  unique(tender_id, vendor_email)
);

create index idx_site_visit_regs_tender on tender_site_visit_registrations(tender_id);

alter table tender_site_visit_registrations enable row level security;
create policy tenant_isolation_site_visit_regs on tender_site_visit_registrations
  using (tender_id in (select id from tenders where tenant_id = current_tenant_id()))
  with check (tender_id in (select id from tenders where tenant_id = current_tenant_id()));

-- Link submissions to site visit registrations
alter table tender_submissions add column site_visit_registration_id uuid
  references tender_site_visit_registrations(id) on delete set null;
