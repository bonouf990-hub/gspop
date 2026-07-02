-- Let an owner grant/revoke owner access to any account, safely. Both functions
-- are SECURITY DEFINER and check the *caller* is already an owner, so only an
-- owner can ever change owner access or see who has it.

create or replace function set_owner_by_email(target_email text, val boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare cnt int;
begin
  if not coalesce((select is_owner from user_profiles where id = auth.uid()), false) then
    raise exception 'Only an owner can change owner access';
  end if;
  update user_profiles set is_owner = val
   where id = (select id from auth.users where lower(email) = lower(trim(target_email)));
  get diagnostics cnt = row_count;
  return cnt; -- 0 means no account with that email (create the user first)
end;
$$;

create or replace function list_owners()
returns table(id uuid, full_name text, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((select is_owner from user_profiles where id = auth.uid()), false) then
    raise exception 'Only an owner can view this';
  end if;
  return query
    select up.id, up.full_name, au.email::text
      from user_profiles up
      join auth.users au on au.id = up.id
     where up.is_owner = true
     order by up.full_name;
end;
$$;

grant execute on function set_owner_by_email(text, boolean) to authenticated;
grant execute on function list_owners() to authenticated;
