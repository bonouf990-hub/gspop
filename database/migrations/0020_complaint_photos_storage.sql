-- GSPOP: Storage bucket for photos a resident attaches when reporting an issue,
-- so a technician can see the actual problem (leaking tap, broken AC, cracked tile)
-- before arriving. Private bucket — complaint photos can show a resident's interior,
-- so access is scoped to the same tenant as the parent complaint (resident + ops staff).
--
-- Path convention: {complaintId}/{uuid}.{ext}. The parent complaint is created first,
-- so its id already exists (and is tenant-scoped) by the time photos are uploaded.

insert into storage.buckets (id, name, public)
values ('complaint-photos', 'complaint-photos', false)
on conflict (id) do nothing;

-- Resident uploads photos into a complaint they own (tenant-scoped via the parent).
drop policy if exists complaint_photos_insert on storage.objects;
create policy complaint_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'complaint-photos'
    and (storage.foldername(name))[1]::uuid in (
      select id from complaints where tenant_id = current_tenant_id()
    )
  );

-- Anyone in the same tenant (the resident + ops staff triaging it) can read them.
drop policy if exists complaint_photos_select on storage.objects;
create policy complaint_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'complaint-photos'
    and (storage.foldername(name))[1]::uuid in (
      select id from complaints where tenant_id = current_tenant_id()
    )
  );
