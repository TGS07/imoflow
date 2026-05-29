-- PEOPLE
create table public.people (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create index people_agency_idx on people(agency_id);

-- ORGANIZATIONS
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  website text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create index organizations_agency_idx on organizations(agency_id);

-- ADD FK COLUMNS TO LEADS
alter table public.leads add column person_id uuid references public.people(id) on delete set null;
alter table public.leads add column organization_id uuid references public.organizations(id) on delete set null;

-- MIGRATE: Create people from existing leads
do $$
declare
  lead_row record;
  new_person_id uuid;
begin
  for lead_row in select id, agency_id, name, email, phone from public.leads loop
    insert into public.people (agency_id, name, email, phone)
    values (lead_row.agency_id, lead_row.name, lead_row.email, lead_row.phone)
    returning id into new_person_id;

    update public.leads set person_id = new_person_id where id = lead_row.id;
  end loop;
end $$;

-- RLS for people
alter table public.people enable row level security;
create policy "people: own agency" on public.people
  for all using (agency_id = public.get_my_agency_id());

-- RLS for organizations
alter table public.organizations enable row level security;
create policy "organizations: own agency" on public.organizations
  for all using (agency_id = public.get_my_agency_id());
