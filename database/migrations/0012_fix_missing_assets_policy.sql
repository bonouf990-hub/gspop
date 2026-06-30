-- GSPOP: assets had RLS enabled in 0001 but never got a policy — deny-all
-- by omission, same root cause as the earlier user_profiles/units gaps.

create policy tenant_isolation_assets on assets
  using (property_id in (select id from properties where tenant_id = current_tenant_id()));
