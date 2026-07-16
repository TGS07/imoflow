-- Consultores imobiliários associados a um imóvel (partilha entre agências).
-- Distinto de seller_id: um imóvel tem no máximo um vendedor, mas pode ter
-- vários consultores associados.
create table if not exists public.property_consultants (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  person_id    uuid not null references public.people(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (property_id, person_id)
);

create index if not exists property_consultants_property_idx on public.property_consultants(property_id);
create index if not exists property_consultants_person_idx on public.property_consultants(person_id);

alter table public.property_consultants enable row level security;
create policy "property_consultants: own agency" on public.property_consultants
  for all using (agency_id = public.get_my_agency_id());
