-- CONTACT SIGLAS
create table public.contact_siglas (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  code text not null,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(agency_id, code)
);

create index contact_siglas_agency_idx on contact_siglas(agency_id);

alter table public.contact_siglas enable row level security;
create policy "contact_siglas: own agency" on public.contact_siglas
  for all using (agency_id = public.get_my_agency_id());

-- SEED: siglas já usadas manualmente pelo utilizador na configuração de contactos do iPhone/iCloud
do $$
declare
  agency record;
begin
  for agency in select id from public.agencies loop
    insert into public.contact_siglas (agency_id, code, label) values
      (agency.id, 'CC', 'Cliente Comprador'),
      (agency.id, 'CV', 'Cliente Vendedor'),
      (agency.id, 'SCC', 'Contabilista'),
      (agency.id, 'SR', 'Remodelações')
    on conflict (agency_id, code) do nothing;
  end loop;
end $$;
