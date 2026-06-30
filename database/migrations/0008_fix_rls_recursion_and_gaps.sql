-- GSPOP: Fix RLS recursion + close policy gaps.
--
-- Supabase enables RLS by default on every new table, including ones we
-- never explicitly wrote a policy for. With RLS on and zero policies, a
-- table is fully locked (deny-all) — including user_profiles itself, which
-- broke current_tenant_id() and is_resident() for every other table's
-- policy that depends on them (those functions query user_profiles, which
-- was itself blocked, so they silently returned null for everyone).
--
-- Fix: make the helper functions SECURITY DEFINER (a trusted, narrowly-
-- scoped bypass of RLS only for resolving "what tenant/role is this user",
-- not general data access), then add real policies to every table that was
-- silently locked.

-- ── 1. Helper functions: bypass RLS only to resolve tenant/role ────────
create or replace function current_tenant_id() returns uuid as $$
  select tenant_id from user_profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create or replace function is_resident() returns boolean as $$
  select role = 'resident' from user_profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- ── 2. user_profiles: a user sees their own row + everyone in their tenant ─
create policy user_profiles_tenant_read on user_profiles
  for select using (id = auth.uid() or tenant_id = current_tenant_id());

create policy user_profiles_self_update on user_profiles
  for update using (id = auth.uid());

-- ── 3. units: scoped via the parent property's tenant ───────────────────
create policy tenant_isolation_units on units
  using (property_id in (select id from properties where tenant_id = current_tenant_id()));

-- ── 4. Work-order child tables: scoped via the parent work order ───────
create policy tenant_isolation_checkins on work_order_checkins
  using (work_order_id in (select id from work_orders where tenant_id = current_tenant_id()))
  with check (work_order_id in (select id from work_orders where tenant_id = current_tenant_id()));

create policy tenant_isolation_wo_photos on work_order_photos
  using (work_order_id in (select id from work_orders where tenant_id = current_tenant_id()))
  with check (work_order_id in (select id from work_orders where tenant_id = current_tenant_id()));

create policy tenant_isolation_wo_ratings on work_order_ratings
  using (work_order_id in (select id from work_orders where tenant_id = current_tenant_id()))
  with check (work_order_id in (select id from work_orders where tenant_id = current_tenant_id()));

-- ── 5. Inventory movements: scoped via the parent inventory item ───────
create policy tenant_isolation_inventory_movements on inventory_movements
  using (inventory_item_id in (select id from inventory_items where tenant_id = current_tenant_id()))
  with check (inventory_item_id in (select id from inventory_items where tenant_id = current_tenant_id()));

-- ── 6. Approvals: scoped to approvers within the same tenant ────────────
create policy tenant_isolation_approvals on approvals
  using (approver_id in (select id from user_profiles where tenant_id = current_tenant_id()))
  with check (approver_id in (select id from user_profiles where tenant_id = current_tenant_id()));

-- ── 7. Audit log: scoped to actors within the same tenant ───────────────
create policy tenant_isolation_audit_log on audit_log
  using (actor_id in (select id from user_profiles where tenant_id = current_tenant_id()))
  with check (actor_id in (select id from user_profiles where tenant_id = current_tenant_id()));

-- ── 8. Asset lifecycle events: scoped via the parent asset's property ──
create policy tenant_isolation_asset_lifecycle on asset_lifecycle_events
  using (asset_id in (
    select id from assets where property_id in (select id from properties where tenant_id = current_tenant_id())
  ))
  with check (asset_id in (
    select id from assets where property_id in (select id from properties where tenant_id = current_tenant_id())
  ));

-- ── 9. Complaint photos: scoped via the parent complaint ───────────────
create policy tenant_isolation_complaint_photos on complaint_photos
  using (complaint_id in (select id from complaints where tenant_id = current_tenant_id()))
  with check (complaint_id in (select id from complaints where tenant_id = current_tenant_id()));

-- ── 10. Notifications: personal — only the recipient sees their own ────
create policy own_notifications on notifications
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- ── 11. Lease occupants: scoped via the parent lease's property ────────
create policy tenant_isolation_lease_occupants on lease_occupants
  using (lease_id in (
    select id from leases where unit_id in (
      select id from units where property_id in (select id from properties where tenant_id = current_tenant_id())
    )
  ))
  with check (lease_id in (
    select id from leases where unit_id in (
      select id from units where property_id in (select id from properties where tenant_id = current_tenant_id())
    )
  ));

-- ── 12. Access events: scoped via the parent credential ─────────────────
create policy tenant_isolation_access_events on access_events
  using (credential_id in (select id from access_credentials where tenant_id = current_tenant_id()))
  with check (credential_id in (select id from access_credentials where tenant_id = current_tenant_id()));

-- ── 13. Maintenance schedules: scoped via the parent asset's property ──
create policy tenant_isolation_maintenance_schedules on maintenance_schedules
  using (asset_id in (
    select id from assets where property_id in (select id from properties where tenant_id = current_tenant_id())
  ))
  with check (asset_id in (
    select id from assets where property_id in (select id from properties where tenant_id = current_tenant_id())
  ));

-- ── 14. Utility meters + readings: scoped via property ──────────────────
create policy tenant_isolation_utility_meters on utility_meters
  using (property_id in (select id from properties where tenant_id = current_tenant_id()))
  with check (property_id in (select id from properties where tenant_id = current_tenant_id()));

create policy tenant_isolation_utility_readings on utility_readings
  using (meter_id in (
    select id from utility_meters where property_id in (select id from properties where tenant_id = current_tenant_id())
  ))
  with check (meter_id in (
    select id from utility_meters where property_id in (select id from properties where tenant_id = current_tenant_id())
  ));

-- ── 15. Common-area bookings: scoped via the common area's property ────
create policy tenant_isolation_bookings on common_area_bookings
  using (common_area_id in (
    select id from common_areas where property_id in (select id from properties where tenant_id = current_tenant_id())
  ))
  with check (common_area_id in (
    select id from common_areas where property_id in (select id from properties where tenant_id = current_tenant_id())
  ));

-- ── 16. KPI definitions + scores ────────────────────────────────────────
create policy tenant_isolation_kpi_definitions on kpi_definitions
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy tenant_isolation_kpi_scores on kpi_scores
  using (user_id in (select id from user_profiles where tenant_id = current_tenant_id()))
  with check (user_id in (select id from user_profiles where tenant_id = current_tenant_id()));

-- ── 17. Move checklist items: scoped via the parent checklist's lease ──
create policy tenant_isolation_move_checklist_items on move_checklist_items
  using (checklist_id in (
    select id from move_checklists where lease_id in (
      select id from leases where unit_id in (
        select id from units where property_id in (select id from properties where tenant_id = current_tenant_id())
      )
    )
  ))
  with check (checklist_id in (
    select id from move_checklists where lease_id in (
      select id from leases where unit_id in (
        select id from units where property_id in (select id from properties where tenant_id = current_tenant_id())
      )
    )
  ));

-- ── 18. tenants table itself: a user can read their own tenant row ─────
alter table tenants enable row level security;
create policy own_tenant on tenants
  using (id = current_tenant_id());
