-- AGENCIES
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  logo_url text,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

-- USERS (perfil ligado ao auth.users do Supabase)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'admin',
  avatar_initials text not null default 'XX'
);

-- LEADS
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  stage text not null default 'lead',
  score int not null default 50,
  source text not null default 'outro',
  budget numeric,
  zone text,
  typology text,
  notes text,
  created_at timestamptz not null default now()
);

-- CONTACTS (histórico de interações)
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  type text not null default 'nota',
  title text not null,
  description text,
  note text,
  created_at timestamptz not null default now()
);

-- TASKS
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  title text not null,
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- EMAILS_SENT
create table public.emails_sent (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  sent_by uuid references public.users(id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'sent',
  sent_at timestamptz not null default now()
);

-- ROW LEVEL SECURITY
alter table public.agencies enable row level security;
alter table public.users enable row level security;
alter table public.leads enable row level security;
alter table public.contacts enable row level security;
alter table public.tasks enable row level security;
alter table public.emails_sent enable row level security;

-- Função helper para obter agency_id do utilizador autenticado
create or replace function public.get_my_agency_id()
returns uuid
language sql stable
as $$
  select agency_id from public.users where id = auth.uid()
$$;

-- POLICIES: users só vêem dados da sua agência
create policy "users: own agency" on public.users
  for all using (agency_id = public.get_my_agency_id());

create policy "leads: own agency" on public.leads
  for all using (agency_id = public.get_my_agency_id());

create policy "contacts: own agency" on public.contacts
  for all using (
    lead_id in (select id from public.leads where agency_id = public.get_my_agency_id())
  );

create policy "tasks: own agency" on public.tasks
  for all using (
    lead_id in (select id from public.leads where agency_id = public.get_my_agency_id())
  );

create policy "emails_sent: own agency" on public.emails_sent
  for all using (
    lead_id in (select id from public.leads where agency_id = public.get_my_agency_id())
  );

-- agencies: apenas service_role pode criar (via admin panel)
create policy "agencies: read own" on public.agencies
  for select using (id = public.get_my_agency_id());
