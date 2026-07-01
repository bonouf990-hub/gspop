-- Tendering system: create tenders (RFPs), vendors submit bids,
-- AI analyzes and scores submissions, winner flows to purchasing.

create table tenders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  title text not null,
  description text not null,
  scope_of_work text not null,
  budget_estimate numeric(14,2),
  currency text not null default 'AED',
  submission_deadline timestamptz not null,
  status text not null default 'draft' check (status in (
    'draft','published','closed','evaluating','decided','cancelled'
  )),
  created_by uuid not null references user_profiles(id),
  decided_vendor_id uuid references vendors(id),
  decided_at timestamptz,
  decided_reason text,
  created_at timestamptz not null default now()
);

create index idx_tenders_tenant on tenders(tenant_id);
create index idx_tenders_status on tenders(status);

alter table tenders enable row level security;
create policy tenant_isolation_tenders on tenders
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create table tender_requirements (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references tenders(id) on delete cascade,
  category text not null check (category in (
    'certification','experience','financial','technical','timeline','insurance','other'
  )),
  title text not null,
  description text,
  is_mandatory boolean not null default true,
  weight int not null default 10 check (weight between 1 and 100),
  sort_order int not null default 0
);

create index idx_tender_requirements_tender on tender_requirements(tender_id);

alter table tender_requirements enable row level security;
create policy tenant_isolation_tender_requirements on tender_requirements
  using (tender_id in (select id from tenders where tenant_id = current_tenant_id()))
  with check (tender_id in (select id from tenders where tenant_id = current_tenant_id()));

create table tender_submissions (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references tenders(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete set null,
  vendor_name text not null,
  vendor_email text not null,
  vendor_phone text,
  company_registration text,
  proposed_amount numeric(14,2) not null,
  proposed_timeline_days int,
  cover_letter text,
  technical_approach text,
  status text not null default 'submitted' check (status in (
    'submitted','under_review','shortlisted','winner','rejected'
  )),
  ai_score numeric(5,2),
  ai_summary text,
  ai_missing_items text,
  ai_strengths text,
  ai_weaknesses text,
  submitted_at timestamptz not null default now()
);

create index idx_tender_submissions_tender on tender_submissions(tender_id);

alter table tender_submissions enable row level security;
create policy tenant_isolation_tender_submissions on tender_submissions
  using (tender_id in (select id from tenders where tenant_id = current_tenant_id()))
  with check (tender_id in (select id from tenders where tenant_id = current_tenant_id()));

create table tender_submission_responses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references tender_submissions(id) on delete cascade,
  requirement_id uuid not null references tender_requirements(id) on delete cascade,
  response text,
  document_url text,
  meets_requirement boolean
);

create index idx_tender_responses_submission on tender_submission_responses(submission_id);

alter table tender_submission_responses enable row level security;
create policy tenant_isolation_tender_responses on tender_submission_responses
  using (submission_id in (
    select id from tender_submissions where tender_id in (
      select id from tenders where tenant_id = current_tenant_id()
    )
  ))
  with check (submission_id in (
    select id from tender_submissions where tender_id in (
      select id from tenders where tenant_id = current_tenant_id()
    )
  ));

-- Public access token for vendor submission portal
create table tender_access_tokens (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references tenders(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);

create index idx_tender_access_tokens_token on tender_access_tokens(token);
