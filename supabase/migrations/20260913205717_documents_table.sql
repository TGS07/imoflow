-- DOCUMENTS
-- Generic document attachments for leads, people (contacts) and properties.
-- Files themselves live in the private `documents` storage bucket
-- (see 20260913203438_storage_buckets.sql) under <agency_id>/<entity_type>/<entity_id>/<filename>.
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies(id) on delete cascade,
  entity_type  text not null check (entity_type in ('lead','person','property')),
  entity_id    uuid not null,
  name         text not null,
  file_path    text not null,
  file_type    text,
  file_size    bigint,
  uploaded_by  uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index documents_entity_idx on documents(agency_id, entity_type, entity_id);

alter table public.documents enable row level security;
create policy "documents: own agency" on public.documents
  for all using (agency_id = public.get_my_agency_id());
