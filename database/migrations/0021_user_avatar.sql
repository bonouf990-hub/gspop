-- GSPOP: Let a resident (or any user) set a profile photo of themselves, shown
-- on their account page. Adds an avatar_path pointing into a private "avatars"
-- storage bucket. Path convention: {userId}/{uuid}.{ext} — each user owns the
-- folder named after their own auth uid.

alter table user_profiles
  add column if not exists avatar_path text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Only the owner may write/replace/remove files inside their own {userId}/ folder.
drop policy if exists avatars_owner_write on storage.objects;
create policy avatars_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone in the same tenant can view an avatar (owner, plus admins/managers who
-- can already see resident profiles). Scoped via the folder owner's tenant.
drop policy if exists avatars_tenant_read on storage.objects;
create policy avatars_tenant_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1]::uuid in (
        select id from user_profiles where tenant_id = current_tenant_id()
      )
    )
  );
