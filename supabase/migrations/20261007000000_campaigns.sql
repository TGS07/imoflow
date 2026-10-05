-- Histórico das campanhas de email enviadas a partir do admin.
-- Aditiva: tabela nova, só acedida pelo service role (RLS ativo, sem policies).
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  cta_label text,
  cta_url text,
  audience text not null check (audience in ('all', 'trial', 'paid', 'free')),
  status text not null default 'sending' check (status in ('sending', 'sent', 'partial', 'failed')),
  recipient_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.campaigns enable row level security;
