-- GSPOP: Visitor pre-authorization — residents invite guests/deliveries/
-- service providers ahead of arrival, with an expected time window, so
-- security can verify against a pre-approved list instead of guessing.

alter table visitors
  add column expected_window_start timestamptz,
  add column expected_window_end timestamptz,
  add column brand_name text,
  add column leave_with_security boolean not null default false,
  add column status text not null default 'invited'
    check (status in ('invited', 'checked_in', 'checked_out', 'declined', 'expired'));

create index idx_visitors_status on visitors(status);
create index idx_visitors_host on visitors(host_resident_id);
