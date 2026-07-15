-- Contactos: flag "regular" (follow-ups automáticos), atribuição de agente,
-- data de nascimento; leads também ganham a flag "regular"; agências ganham
-- os prazos (X/Y dias) dos lembretes de follow-up.

-- people
alter table public.people add column if not exists is_regular boolean not null default false;
alter table public.people add column if not exists assigned_to uuid references public.users(id) on delete set null;
alter table public.people add column if not exists birthday date;

-- leads
alter table public.leads add column if not exists is_regular boolean not null default false;

-- agencies: prazos dos lembretes de follow-up de contactos regulares
alter table public.agencies add column if not exists followup_first_days int not null default 7;
alter table public.agencies add column if not exists followup_second_days int not null default 30;

-- Índice para o cron filtrar rapidamente contactos regulares por agência
create index if not exists people_regular_idx on public.people (agency_id) where is_regular;
create index if not exists leads_regular_idx on public.leads (agency_id) where is_regular;

-- Backfill: contactos sem responsável ficam com o admin da respetiva agência
-- (na SATUS3 e restantes, o primeiro admin criado). Sem responsável definido
-- ninguém receberia os lembretes de follow-up.
update public.people p
set assigned_to = (
  select u.id from public.users u
  where u.agency_id = p.agency_id and u.role = 'admin'
  order by u.created_at asc
  limit 1
)
where p.assigned_to is null;
