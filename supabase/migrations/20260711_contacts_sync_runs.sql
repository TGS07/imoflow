-- Regista cada ciclo do contacts-sync-bot (Contactos do iPhone -> people),
-- para o dashboard mostrar "última sincronização" e confirmar que o bot
-- (cron no Railway, a cada 6h) continua vivo.
create table if not exists public.contacts_sync_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  ran_at timestamptz not null default now(),
  contacts_seen int not null default 0,
  contacts_processed int not null default 0
);

create index if not exists contacts_sync_runs_agency_ran_at_idx
  on public.contacts_sync_runs (agency_id, ran_at desc);

alter table public.contacts_sync_runs enable row level security;

create policy "contacts_sync_runs: own agency" on public.contacts_sync_runs
  for select using (agency_id = public.get_my_agency_id());
