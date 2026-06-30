-- GSPOP: Test data seed, linked to manually-created auth users.
-- Safe to re-run is NOT guaranteed (will error on unique conflicts) — run once.

do $$
declare
  v_tenant_id uuid;
  v_property_id uuid;
  v_unit_id uuid;
  v_common_area_id uuid;
  v_asset_id uuid;
  v_lease_id uuid;
  v_work_order_id uuid;
  v_manager_id uuid := '13755580-ff29-4fcf-a984-064bed10db44';
  v_tech_id uuid := 'a794a8c3-5004-438b-8d11-103fd39c997d';
  v_resident_id uuid := 'd1429506-3fda-4e74-9769-209010a3b843';
begin
  insert into tenants (name) values ('Golden Sands (Test)') returning id into v_tenant_id;

  insert into properties (tenant_id, name, address)
  values (v_tenant_id, 'GS5 Test Building', 'Test Street, Dubai')
  returning id into v_property_id;

  insert into units (property_id, label, floor, bedrooms, bathrooms, size_sqm, max_occupancy)
  values (v_property_id, 'GS5-1203', '12', 2, 2, 95.5, 4)
  returning id into v_unit_id;

  insert into common_areas (property_id, name, category, floor)
  values (v_property_id, 'Basement Parking', 'parking', 'B1')
  returning id into v_common_area_id;

  -- user_profiles linked to the auth users you created in the dashboard
  insert into user_profiles (id, tenant_id, full_name, role, department, job_title)
  values
    (v_manager_id, v_tenant_id, 'Test Manager', 'property_manager', 'Operations', 'Property Manager'),
    (v_tech_id, v_tenant_id, 'Test Technician', 'technician', 'Maintenance', 'AC Technician'),
    (v_resident_id, v_tenant_id, 'Test Resident', 'resident', null, null)
  on conflict (id) do nothing;

  update user_profiles set reports_to_id = v_manager_id where id = v_tech_id;

  insert into assets (property_id, unit_id, name, category, condition, status, maintenance_cycle_months, next_maintenance_due)
  values (v_property_id, v_unit_id, 'Split AC Unit - Living Room', 'HVAC', 'used', 'in_service', 6, current_date + interval '30 days')
  returning id into v_asset_id;

  insert into leases (unit_id, primary_resident_id, tenant_full_name, start_date, occupant_count, rent_amount, rent_frequency, deposit_amount, parking_space_label)
  values (v_unit_id, v_resident_id, 'Test Resident', current_date - interval '60 days', 2, 4500, 'monthly', 4500, 'B1-22')
  returning id into v_lease_id;

  insert into rent_invoices (lease_id, amount, due_date, status)
  values (v_lease_id, 4500, current_date + interval '5 days', 'pending');

  insert into work_orders (tenant_id, property_id, unit_id, asset_id, type, priority, status, title, description, created_by, assigned_technician_id)
  values (v_tenant_id, v_property_id, v_unit_id, v_asset_id, 'corrective', 'high', 'in_progress',
          'AC not cooling', 'Resident reports AC blowing warm air in living room.', v_manager_id, v_tech_id)
  returning id into v_work_order_id;

  insert into complaints (tenant_id, property_id, unit_id, asset_id, resident_id, title, description, status, priority, work_order_id)
  values (v_tenant_id, v_property_id, v_unit_id, v_asset_id, v_resident_id,
          'AC not cooling', 'The AC in the living room stopped cooling since yesterday.', 'in_progress', 'high', v_work_order_id);

  insert into building_notices (tenant_id, property_id, title, body, posted_by)
  values (v_tenant_id, v_property_id, 'Water Tank Cleaning',
          'Building water tank cleaning scheduled this Friday 10am-2pm. Minor pressure drop expected.', v_manager_id);
end $$;
