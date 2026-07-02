-- Private GM tools: a single owner flag on user_profiles. Only accounts with
-- is_owner = true can see or open the Integrity Watch. Nobody else — including
-- other admins — sees it in the sidebar or can reach the page.
alter table user_profiles add column if not exists is_owner boolean not null default false;
