-- Link purchase orders to tenders for full procurement traceability
alter table purchase_orders add column tender_id uuid references tenders(id);
-- Approval metadata
alter table purchase_orders add column approved_by uuid references user_profiles(id);
alter table purchase_orders add column approved_at timestamptz;
alter table purchase_orders add column notes text;
alter table purchase_orders add column urgency text default 'normal' check (urgency in ('normal', 'urgent', 'critical'));
