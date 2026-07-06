create table if not exists public.property_visits (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  person_id    uuid references public.people(id) on delete set null,
  visitor_name text,
  agency_name  text,
  visited_at   timestamptz not null default now(),
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists property_visits_property_idx on public.property_visits(property_id, visited_at desc);

alter table public.property_visits enable row level security;
create policy "property_visits: own agency" on public.property_visits
  for all using (agency_id = public.get_my_agency_id());
