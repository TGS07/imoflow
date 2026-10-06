-- Registo dos emails de novidades enviados por deploy + opt-out por utilizador.
-- Aditiva: não altera dados existentes.
create table if not exists public.release_notes (
  id uuid primary key default gen_random_uuid(),
  sha text not null unique,
  commits jsonb not null default '[]'::jsonb,
  summary jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'partial', 'failed', 'skipped')),
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Só acedida pelo service role (sem policies).
alter table public.release_notes enable row level security;

alter table public.users
  add column if not exists product_updates_opt_out boolean not null default false;
