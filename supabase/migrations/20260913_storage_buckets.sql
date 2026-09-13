-- STORAGE BUCKETS
-- property-photos: public bucket for property photos (max 5MB per file)
-- documents: private bucket for lead/person/property documents (max 10MB per file)
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('property-photos', 'property-photos', true, 5242880),
  ('documents', 'documents', false, 10485760)
on conflict (id) do nothing;

-- RLS policies for storage.objects
-- Files are expected to be stored under a path of the form:
--   <agency_id>/<entity_id>/<filename>
-- so (storage.foldername(name))[1] is the agency_id segment.

-- property-photos: public read, authenticated + own-agency write
create policy "property-photos: public read"
  on storage.objects
  for select
  using (bucket_id = 'property-photos');

create policy "property-photos: own agency insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'property-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  );

create policy "property-photos: own agency update"
  on storage.objects
  for update
  using (
    bucket_id = 'property-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  )
  with check (
    bucket_id = 'property-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  );

create policy "property-photos: own agency delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'property-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  );

-- documents: fully private, authenticated + own-agency only
create policy "documents: own agency select"
  on storage.objects
  for select
  using (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  );

create policy "documents: own agency insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  );

create policy "documents: own agency update"
  on storage.objects
  for update
  using (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  )
  with check (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  );

create policy "documents: own agency delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  );
