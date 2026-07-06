-- ENRIQUECER people (base central de Contactos)
alter table public.people add column if not exists types text[] not null default '{}';
alter table public.people add column if not exists financial_capacity text
  check (financial_capacity in ('muito_baixo','baixo','medio','medio_alto','alto','altissimo'));
alter table public.people add column if not exists source text;
alter table public.people add column if not exists last_interaction_at timestamptz;
alter table public.people add column if not exists details jsonb not null default '{}';

create index if not exists people_types_idx on public.people using gin (types);
create index if not exists people_last_interaction_idx on public.people(agency_id, last_interaction_at);

-- INTERAÇÕES por contacto (distinto da tabela `contacts`, que é por lead)
create table if not exists public.contact_interactions (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  person_id   uuid not null references public.people(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  type        text not null check (type in ('chamada','visita','email','whatsapp','nota')),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists contact_interactions_person_idx
  on public.contact_interactions(person_id, created_at desc);

alter table public.contact_interactions enable row level security;
create policy "contact_interactions: own agency" on public.contact_interactions
  for all using (agency_id = public.get_my_agency_id());
