-- GSPOP: Storage bucket for mandatory before/after photos taken by technicians
-- during a work order. Private bucket — photos may show a resident's unit interior,
-- so access is scoped to the same tenant as the parent work order.
--
-- Path convention: {workOrderId}/{stage}_{uuid}.{ext}

insert into storage.buckets (id, name, public)
values ('work-order-photos', 'work-order-photos', false)
on conflict (id) do nothing;

-- Technicians upload photos into a work order they are assigned to (tenant-scoped).
drop policy if exists wo_photos_insert on storage.objects;
create policy wo_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'work-order-photos'
    and (storage.foldername(name))[1]::uuid in (
      select id from work_orders where tenant_id = current_tenant_id()
    )
  );

-- Anyone in the same tenant (technician, supervisor, manager) can view them.
drop policy if exists wo_photos_select on storage.objects;
create policy wo_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'work-order-photos'
    and (storage.foldername(name))[1]::uuid in (
      select id from work_orders where tenant_id = current_tenant_id()
    )
  );
