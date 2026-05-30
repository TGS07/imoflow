-- PROPERTIES
create table public.properties (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  reference   text,
  title       text not null,
  type        text not null check (type in ('apartamento','moradia','terreno','loja','escritorio','armazem','outro')),
  status      text not null default 'disponivel' check (status in ('disponivel','reservado','vendido','arrendado')),
  price       numeric,
  area_m2     numeric,
  typology    text,
  bedrooms    int,
  bathrooms   int,
  floor       text,
  condition   text check (condition in ('novo','usado','renovado','em_construcao')),
  address     text,
  city        text,
  zone        text,
  postal_code text,
  latitude    numeric,
  longitude   numeric,
  description text,
  features    jsonb default '[]',
  photos      jsonb default '[]',
  notes       text,
  created_at  timestamptz not null default now()
);

create index properties_agency_idx on properties(agency_id);
create index properties_status_idx on properties(agency_id, status);

-- ADD FK TO LEADS
alter table public.leads add column property_id uuid references public.properties(id) on delete set null;

-- RLS for properties
alter table public.properties enable row level security;
create policy "properties: own agency" on public.properties
  for all using (agency_id = public.get_my_agency_id());
