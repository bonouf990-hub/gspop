-- GSPOP: Security hardening — add RLS to unprotected tables,
-- role-scoped policies for technicians, and resident isolation for bookings.
-- Idempotent: every policy is dropped before being (re)created.

-- ── Helper: current user role (bypass RLS) ────────────────────────────────
create or replace function current_user_role() returns text as $$
  select role from user_profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- ── Column the app expects but no migration ever added ────────────────────
-- AI Brain assignment and technician views read/write work_orders.assigned_to
-- (join hint work_orders_assigned_to_fkey). Add it alongside
-- assigned_technician_id.
alter table work_orders add column if not exists assigned_to uuid references user_profiles(id);

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Enable RLS on tables that were missing it
-- ══════════════════════════════════════════════════════════════════════════

alter table work_order_checkins enable row level security;
alter table work_order_photos enable row level security;
alter table work_order_ratings enable row level security;
alter table inventory_movements enable row level security;
alter table approvals enable row level security;
alter table audit_log enable row level security;
alter table asset_lifecycle_events enable row level security;
alter table access_events enable row level security;
alter table utility_meters enable row level security;
alter table utility_readings enable row level security;
alter table lease_occupants enable row level security;
alter table move_checklist_items enable row level security;
alter table kpi_definitions enable row level security;
alter table kpi_scores enable row level security;
alter table complaint_photos enable row level security;
alter table tender_access_tokens enable row level security;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Tenant-isolation policies for newly RLS-enabled tables
--    (0008 created some of these names already — drop first, then recreate)
-- ══════════════════════════════════════════════════════════════════════════

-- work_order_photos: scoped via work_orders tenant
drop policy if exists tenant_isolation_wo_photos on work_order_photos;
create policy tenant_isolation_wo_photos on work_order_photos
  for all using (
    work_order_id in (select id from work_orders where tenant_id = current_tenant_id())
  );

-- inventory_movements: scoped via inventory_items tenant
drop policy if exists tenant_isolation_inv_movements on inventory_movements;
create policy tenant_isolation_inv_movements on inventory_movements
  for all using (
    inventory_item_id in (select id from inventory_items where tenant_id = current_tenant_id())
  );

-- approvals: scoped via approver's tenant
drop policy if exists tenant_isolation_approvals on approvals;
create policy tenant_isolation_approvals on approvals
  for all using (
    approver_id in (select id from user_profiles where tenant_id = current_tenant_id())
  );

-- audit_log: scoped via actor's tenant
drop policy if exists tenant_isolation_audit_log on audit_log;
create policy tenant_isolation_audit_log on audit_log
  for all using (
    actor_id in (select id from user_profiles where tenant_id = current_tenant_id())
  );

-- asset_lifecycle_events: scoped via assets → properties → tenant
drop policy if exists tenant_isolation_asset_events on asset_lifecycle_events;
create policy tenant_isolation_asset_events on asset_lifecycle_events
  for all using (
    asset_id in (
      select id from assets where property_id in (
        select id from properties where tenant_id = current_tenant_id()
      )
    )
  );

-- access_events: scoped via access_credentials → tenant
drop policy if exists tenant_isolation_access_events on access_events;
create policy tenant_isolation_access_events on access_events
  for all using (
    credential_id in (select id from access_credentials where tenant_id = current_tenant_id())
  );

-- utility_meters: scoped via properties → tenant
drop policy if exists tenant_isolation_utility_meters on utility_meters;
create policy tenant_isolation_utility_meters on utility_meters
  for all using (
    property_id in (select id from properties where tenant_id = current_tenant_id())
  );

-- utility_readings: scoped via utility_meters → properties → tenant
drop policy if exists tenant_isolation_utility_readings on utility_readings;
create policy tenant_isolation_utility_readings on utility_readings
  for all using (
    meter_id in (
      select id from utility_meters where property_id in (
        select id from properties where tenant_id = current_tenant_id()
      )
    )
  );

-- lease_occupants: scoped via leases → units → properties → tenant
drop policy if exists tenant_isolation_lease_occupants on lease_occupants;
create policy tenant_isolation_lease_occupants on lease_occupants
  for all using (
    lease_id in (
      select id from leases where unit_id in (
        select id from units where property_id in (
          select id from properties where tenant_id = current_tenant_id()
        )
      )
    )
  );

-- move_checklist_items: scoped via move_checklists → leases → units → properties
drop policy if exists tenant_isolation_checklist_items on move_checklist_items;
create policy tenant_isolation_checklist_items on move_checklist_items
  for all using (
    checklist_id in (
      select mc.id from move_checklists mc
      join leases l on l.id = mc.lease_id
      join units u on u.id = l.unit_id
      join properties p on p.id = u.property_id
      where p.tenant_id = current_tenant_id()
    )
  );

-- kpi_definitions: tenant-scoped
drop policy if exists tenant_isolation_kpi_defs on kpi_definitions;
create policy tenant_isolation_kpi_defs on kpi_definitions
  for all using (tenant_id = current_tenant_id());

-- complaint_photos: scoped via complaints → tenant
drop policy if exists tenant_isolation_complaint_photos_rls on complaint_photos;
create policy tenant_isolation_complaint_photos_rls on complaint_photos
  for all using (
    complaint_id in (select id from complaints where tenant_id = current_tenant_id())
  );

-- tender_access_tokens: scoped via tenders → tenant
drop policy if exists tenant_isolation_tender_tokens on tender_access_tokens;
create policy tenant_isolation_tender_tokens on tender_access_tokens
  for all using (
    tender_id in (select id from tenders where tenant_id = current_tenant_id())
  );

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Role-based policies — technicians see only their own work
-- ══════════════════════════════════════════════════════════════════════════

-- Technicians can only see work orders assigned to them.
-- Management roles (super_admin, tenant_admin, property_manager, supervisor)
-- see all work orders in the tenant.
drop policy if exists tenant_isolation_work_orders on work_orders;
drop policy if exists work_orders_role_scoped on work_orders;
create policy work_orders_role_scoped on work_orders
  for select using (
    tenant_id = current_tenant_id()
    and (
      current_user_role() in ('super_admin', 'tenant_admin', 'property_manager', 'supervisor')
      or assigned_to = auth.uid()
      or assigned_technician_id = auth.uid()
      or created_by = auth.uid()
    )
  );

drop policy if exists work_orders_insert on work_orders;
create policy work_orders_insert on work_orders
  for insert with check (tenant_id = current_tenant_id());

drop policy if exists work_orders_update on work_orders;
create policy work_orders_update on work_orders
  for update using (
    tenant_id = current_tenant_id()
    and (
      current_user_role() in ('super_admin', 'tenant_admin', 'property_manager', 'supervisor')
      or assigned_to = auth.uid()
      or assigned_technician_id = auth.uid()
    )
  );

-- Technicians only see checkins for their own work orders.
-- (No broad tenant policy on this table — the scoped one below is the only
-- permissive policy, so the restriction actually holds.)
drop policy if exists tenant_isolation_checkins on work_order_checkins;
drop policy if exists tenant_isolation_wo_checkins on work_order_checkins;
drop policy if exists wo_checkins_role_scoped on work_order_checkins;
create policy wo_checkins_role_scoped on work_order_checkins
  for all using (
    work_order_id in (
      select id from work_orders where tenant_id = current_tenant_id()
      and (
        current_user_role() in ('super_admin', 'tenant_admin', 'property_manager', 'supervisor')
        or assigned_to = auth.uid()
        or assigned_technician_id = auth.uid()
      )
    )
  );

-- Technicians only see ratings for their own work orders.
-- Drop 0008's broad policy so the scoped one is authoritative.
drop policy if exists tenant_isolation_wo_ratings on work_order_ratings;
drop policy if exists wo_ratings_role_scoped on work_order_ratings;
create policy wo_ratings_role_scoped on work_order_ratings
  for select using (
    work_order_id in (
      select id from work_orders where tenant_id = current_tenant_id()
      and (
        current_user_role() in ('super_admin', 'tenant_admin', 'property_manager', 'supervisor')
        or assigned_to = auth.uid()
        or assigned_technician_id = auth.uid()
      )
    )
  );

-- KPI scores: technicians see only their own.
-- (kpi_scores has no tenant_id column — resolve tenant via user_profiles.)
-- Drop 0008's broad policy so the scoped one is authoritative.
drop policy if exists tenant_isolation_kpi_scores on kpi_scores;
drop policy if exists kpi_scores_own on kpi_scores;
create policy kpi_scores_own on kpi_scores
  for select using (
    user_id in (select id from user_profiles where tenant_id = current_tenant_id())
    and (
      current_user_role() in ('super_admin', 'tenant_admin', 'property_manager', 'supervisor')
      or user_id = auth.uid()
    )
  );

-- Parts requests: technicians see only their own
drop policy if exists tenant_isolation_parts_requests on parts_requests;
drop policy if exists parts_requests_role_scoped on parts_requests;
create policy parts_requests_role_scoped on parts_requests
  for select using (
    tenant_id = current_tenant_id()
    and (
      current_user_role() in ('super_admin', 'tenant_admin', 'property_manager', 'supervisor', 'storekeeper')
      or requested_by = auth.uid()
    )
  );

drop policy if exists parts_requests_insert on parts_requests;
create policy parts_requests_insert on parts_requests
  for insert with check (tenant_id = current_tenant_id());

drop policy if exists parts_requests_update on parts_requests;
create policy parts_requests_update on parts_requests
  for update using (
    tenant_id = current_tenant_id()
    and (
      current_user_role() in ('super_admin', 'tenant_admin', 'property_manager', 'supervisor', 'storekeeper')
      or requested_by = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════════
-- 4. Resident isolation — residents see only their own records
-- ══════════════════════════════════════════════════════════════════════════

-- Bookings: residents can only see their own bookings
drop policy if exists resident_own_bookings on common_area_bookings;
create policy resident_own_bookings on common_area_bookings
  for select using (
    not is_resident()
    or resident_id = auth.uid()
  );

drop policy if exists resident_own_bookings_write on common_area_bookings;
create policy resident_own_bookings_write on common_area_bookings
  for insert with check (
    not is_resident()
    or resident_id = auth.uid()
  );

drop policy if exists resident_own_bookings_update on common_area_bookings;
create policy resident_own_bookings_update on common_area_bookings
  for update using (
    not is_resident()
    or resident_id = auth.uid()
  );

drop policy if exists resident_own_bookings_delete on common_area_bookings;
create policy resident_own_bookings_delete on common_area_bookings
  for delete using (
    not is_resident()
    or resident_id = auth.uid()
  );

-- User profiles: residents cannot browse other users' details
-- (keep existing tenant policy for staff, restrict residents to self)
drop policy if exists resident_own_profile on user_profiles;
create policy resident_own_profile on user_profiles
  for select using (
    not is_resident()
    or id = auth.uid()
  );

-- ══════════════════════════════════════════════════════════════════════════
-- 5. Financial data — restrict to management roles only
-- ══════════════════════════════════════════════════════════════════════════

-- Approvals: management + the assigned approver only
-- (approvals has no requested_by column — approver_id is the only user link)
drop policy if exists approvals_role_scoped on approvals;
create policy approvals_role_scoped on approvals
  for select using (
    current_user_role() in ('super_admin', 'tenant_admin', 'property_manager', 'supervisor')
    or approver_id = auth.uid()
  );

-- Invoices: management full access; vendors can view and submit
-- invoices in their tenant (vendor portal), everyone else blocked.
drop policy if exists tenant_isolation_invoices on invoices;
drop policy if exists invoices_management_only on invoices;
create policy invoices_management_only on invoices
  for all using (
    tenant_id = current_tenant_id()
    and current_user_role() in ('super_admin', 'tenant_admin', 'property_manager', 'supervisor')
  );

drop policy if exists invoices_vendor_select on invoices;
create policy invoices_vendor_select on invoices
  for select using (
    tenant_id = current_tenant_id()
    and current_user_role() = 'vendor'
  );

drop policy if exists invoices_vendor_insert on invoices;
create policy invoices_vendor_insert on invoices
  for insert with check (
    tenant_id = current_tenant_id()
    and current_user_role() = 'vendor'
  );

-- Purchase orders: management + requester; vendors can view POs
-- in their tenant (vendor portal needs them to link invoices).
drop policy if exists tenant_isolation_purchase_orders on purchase_orders;
drop policy if exists purchase_orders_management_only on purchase_orders;
create policy purchase_orders_management_only on purchase_orders
  for all using (
    tenant_id = current_tenant_id()
    and (
      current_user_role() in ('super_admin', 'tenant_admin', 'property_manager', 'supervisor')
      or requested_by = auth.uid()
    )
  );

drop policy if exists purchase_orders_vendor_select on purchase_orders;
create policy purchase_orders_vendor_select on purchase_orders
  for select using (
    tenant_id = current_tenant_id()
    and current_user_role() = 'vendor'
  );

-- Building budgets: management only
drop policy if exists tenant_isolation_building_budgets on building_budgets;
drop policy if exists budgets_management_only on building_budgets;
create policy budgets_management_only on building_budgets
  for all using (
    tenant_id = current_tenant_id()
    and current_user_role() in ('super_admin', 'tenant_admin', 'property_manager')
  );
