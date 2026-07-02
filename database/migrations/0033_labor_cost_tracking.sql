-- Technician salary data for manpower cost calculation
alter table user_profiles add column monthly_salary numeric(12,2);
alter table user_profiles add column hourly_rate numeric(12,2);

-- Time tracking on work orders for labor cost per job
alter table work_orders add column started_at timestamptz;
alter table work_orders add column completed_at timestamptz;
alter table work_orders add column hours_worked numeric(8,2);
