-- Configurable workflow rules: who can do what, per module, per action
-- Admins modify these from /admin/workflows to control routing and permissions

-- Module-action permission matrix
create table workflow_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  module text not null check (module in (
    'work_orders', 'purchase_orders', 'invoices', 'tenders',
    'maintenance', 'complaints', 'inventory', 'vendors',
    'visitors', 'bookings', 'compliance', 'team'
  )),
  action text not null check (action in (
    'create', 'view', 'update', 'delete',
    'assign', 'approve', 'reject', 'escalate',
    'verify', 'close', 'cancel', 'generate_wo',
    'record_payment', 'decide_winner', 'dispatch'
  )),
  allowed_roles text[] not null default '{}',
  max_amount numeric(14,2),
  requires_approval_above numeric(14,2),
  approval_chain text[] default '{}',
  is_active boolean not null default true,
  notes text,
  updated_by uuid references user_profiles(id),
  updated_at timestamptz not null default now(),
  unique(tenant_id, module, action)
);

alter table workflow_rules enable row level security;
create policy tenant_isolation_workflow_rules on workflow_rules
  for all using (tenant_id = current_tenant_id());

-- Approval chain steps for multi-level approval flows
create table approval_chains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  module text not null,
  min_amount numeric(14,2) default 0,
  max_amount numeric(14,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table approval_chains enable row level security;
create policy tenant_isolation_approval_chains on approval_chains
  for all using (tenant_id = current_tenant_id());

create table approval_chain_steps (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references approval_chains(id) on delete cascade,
  step_order int not null,
  approver_role text not null,
  approver_user_id uuid references user_profiles(id),
  is_required boolean not null default true,
  can_skip_if_below numeric(14,2),
  created_at timestamptz not null default now(),
  unique(chain_id, step_order)
);

alter table approval_chain_steps enable row level security;
create policy tenant_isolation_approval_chain_steps on approval_chain_steps
  for all using (chain_id in (select id from approval_chains where tenant_id = current_tenant_id()));

-- Default workflow rules seed (inserted per tenant on setup)
-- This function can be called to initialize rules for a new tenant
create or replace function seed_default_workflow_rules(p_tenant_id uuid)
returns void language plpgsql as $$
begin
  -- Work Orders
  insert into workflow_rules (tenant_id, module, action, allowed_roles, requires_approval_above) values
    (p_tenant_id, 'work_orders', 'create', '{tenant_admin,property_manager,supervisor,technician,call_center}', null),
    (p_tenant_id, 'work_orders', 'view', '{tenant_admin,property_manager,supervisor,technician}', null),
    (p_tenant_id, 'work_orders', 'assign', '{tenant_admin,property_manager,supervisor}', null),
    (p_tenant_id, 'work_orders', 'approve', '{tenant_admin,property_manager,supervisor}', 5000),
    (p_tenant_id, 'work_orders', 'verify', '{tenant_admin,property_manager,supervisor}', null),
    (p_tenant_id, 'work_orders', 'close', '{tenant_admin,property_manager,supervisor}', null),
    (p_tenant_id, 'work_orders', 'cancel', '{tenant_admin,property_manager}', null),
    (p_tenant_id, 'work_orders', 'escalate', '{tenant_admin,property_manager,supervisor}', null)
  on conflict (tenant_id, module, action) do nothing;

  -- Purchase Orders
  insert into workflow_rules (tenant_id, module, action, allowed_roles, requires_approval_above, max_amount) values
    (p_tenant_id, 'purchase_orders', 'create', '{tenant_admin,property_manager,supervisor}', null, null),
    (p_tenant_id, 'purchase_orders', 'approve', '{tenant_admin,property_manager}', 50000, null),
    (p_tenant_id, 'purchase_orders', 'reject', '{tenant_admin,property_manager}', null, null),
    (p_tenant_id, 'purchase_orders', 'escalate', '{tenant_admin,property_manager,supervisor}', null, null)
  on conflict (tenant_id, module, action) do nothing;

  -- Invoices
  insert into workflow_rules (tenant_id, module, action, allowed_roles) values
    (p_tenant_id, 'invoices', 'create', '{tenant_admin,property_manager,supervisor}'),
    (p_tenant_id, 'invoices', 'verify', '{tenant_admin,property_manager,supervisor}'),
    (p_tenant_id, 'invoices', 'approve', '{tenant_admin,property_manager}'),
    (p_tenant_id, 'invoices', 'record_payment', '{tenant_admin,property_manager}')
  on conflict (tenant_id, module, action) do nothing;

  -- Tenders
  insert into workflow_rules (tenant_id, module, action, allowed_roles) values
    (p_tenant_id, 'tenders', 'create', '{tenant_admin,property_manager}'),
    (p_tenant_id, 'tenders', 'decide_winner', '{tenant_admin,property_manager}')
  on conflict (tenant_id, module, action) do nothing;

  -- Maintenance
  insert into workflow_rules (tenant_id, module, action, allowed_roles) values
    (p_tenant_id, 'maintenance', 'create', '{tenant_admin,property_manager,supervisor}'),
    (p_tenant_id, 'maintenance', 'generate_wo', '{tenant_admin,property_manager,supervisor}'),
    (p_tenant_id, 'maintenance', 'update', '{tenant_admin,property_manager,supervisor}')
  on conflict (tenant_id, module, action) do nothing;

  -- Complaints
  insert into workflow_rules (tenant_id, module, action, allowed_roles) values
    (p_tenant_id, 'complaints', 'create', '{tenant_admin,property_manager,supervisor,technician,call_center,resident}'),
    (p_tenant_id, 'complaints', 'assign', '{tenant_admin,property_manager,supervisor}'),
    (p_tenant_id, 'complaints', 'close', '{tenant_admin,property_manager,supervisor}')
  on conflict (tenant_id, module, action) do nothing;

  -- Inventory
  insert into workflow_rules (tenant_id, module, action, allowed_roles) values
    (p_tenant_id, 'inventory', 'create', '{tenant_admin,property_manager,supervisor}'),
    (p_tenant_id, 'inventory', 'dispatch', '{tenant_admin,property_manager,supervisor}'),
    (p_tenant_id, 'inventory', 'update', '{tenant_admin,property_manager,supervisor}')
  on conflict (tenant_id, module, action) do nothing;

  -- Vendors
  insert into workflow_rules (tenant_id, module, action, allowed_roles) values
    (p_tenant_id, 'vendors', 'create', '{tenant_admin,property_manager}'),
    (p_tenant_id, 'vendors', 'update', '{tenant_admin,property_manager}')
  on conflict (tenant_id, module, action) do nothing;
end;
$$;
