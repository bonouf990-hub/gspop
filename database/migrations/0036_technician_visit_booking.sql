-- GSPOP: Technician visit booking — residents schedule non-emergency
-- maintenance visits with preferred date/time and job type.

alter table work_orders add column if not exists preferred_visit_date date;
alter table work_orders add column if not exists preferred_visit_time text;
alter table work_orders add column if not exists visit_source text;
alter table work_orders add column if not exists resident_id uuid references user_profiles(id);

comment on column work_orders.visit_source is 'resident_booking = scheduled visit, complaint = from complaint, null = staff-created';
comment on column work_orders.preferred_visit_date is 'Resident-requested preferred date for technician visit';
comment on column work_orders.preferred_visit_time is 'Resident-requested preferred time slot (morning/afternoon/evening or HH:MM)';
