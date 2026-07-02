-- Contractor invoices linked to purchase orders
create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  purchase_order_id uuid references purchase_orders(id),
  vendor_id uuid references vendors(id),
  invoice_number text not null,
  invoice_date date not null,
  due_date date,
  amount numeric(14,2) not null,
  vat_amount numeric(14,2) default 0,
  total_amount numeric(14,2) not null,
  status text not null default 'received' check (status in ('received', 'verified', 'disputed', 'approved', 'paid')),
  payment_method text check (payment_method in ('cheque', 'bank_transfer', 'cash', 'credit_card')),
  payment_reference text,
  paid_at timestamptz,
  notes text,
  verified_by uuid references user_profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table invoices enable row level security;
create policy tenant_isolation_invoices on invoices
  for all using (tenant_id = current_tenant_id());

-- Operations activity log for audit trail
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references user_profiles(id),
  user_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table activity_log enable row level security;
create policy tenant_isolation_activity_log on activity_log
  for all using (tenant_id = current_tenant_id());

create index idx_activity_log_entity on activity_log(entity_type, entity_id);
create index idx_activity_log_created on activity_log(created_at desc);

-- Notifications: the platform-wide notifications table already exists
-- (created in 0002 with recipient_id/read_at). Extend it for ops-console
-- use — optional headline, deep link, and tenant scoping — instead of
-- creating a second table with the same name.
alter table notifications
  add column if not exists tenant_id uuid references tenants(id) on delete cascade,
  add column if not exists title text,
  add column if not exists link text;

-- Generic severity types used by ops-console alongside the event types.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'complaint_new','complaint_sla_breach','complaint_status_update',
    'work_order_assigned','approval_pending','approval_escalated',
    'notice_posted','rent_cleared',
    'visitor_invited','visitor_arrived','visitor_declined',
    'info','warning','urgent','success'
  ));

create index if not exists idx_notifications_recipient on notifications(recipient_id, created_at desc);
