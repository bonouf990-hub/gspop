-- GSPOP: Call center complaint logging — same category/sub-issue data as
-- the resident app, but entered by an agent on the caller's behalf. Tracks
-- the source so reporting can split "self-service" vs "phoned in" volume,
-- and who logged it for accountability.

alter table complaints
  add column source text not null default 'app' check (source in ('app', 'call_center', 'walk_in')),
  add column logged_by uuid references user_profiles(id);
