-- GSPOP: Security guard role + console support.
-- - 'security' role so guards have their own login, separate from technicians/managers.
-- - emirates_id_number on visitors: data field ready for a future ID scanner/chip
--   integration (hardware project, not buildable in software alone) — the photo
--   capture works today, the scanner just needs to populate this same field later.
-- - notification types for the visitor lifecycle, so security is alerted the
--   moment a resident pre-authorizes someone, and residents are alerted when
--   their guest actually arrives or is turned away.

alter table user_profiles drop constraint user_profiles_role_check;
alter table user_profiles add constraint user_profiles_role_check
  check (role in (
    'super_admin','tenant_admin','property_manager','supervisor','technician','vendor','resident','security'
  ));

alter table visitors
  add column emirates_id_number text;

alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'complaint_new','complaint_sla_breach','work_order_assigned','approval_pending',
    'approval_escalated','visitor_invited','visitor_arrived','visitor_declined'
  ));
