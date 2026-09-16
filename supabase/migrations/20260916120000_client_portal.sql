-- Portal de cliente (Fase 9, Task 9.1): página pública, sem login, que o
-- agente ativa a partir da ficha do lead e envia ao comprador. O token é a
-- autenticação (mesmo padrão de feed_token / calendar_token).
alter table public.leads add column if not exists portal_token uuid default null;

create table if not exists public.portal_views (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  action text not null check (action in ('view', 'favorite', 'request_visit')),
  created_at timestamptz not null default now()
);
create index if not exists portal_views_lead_idx on portal_views(lead_id, created_at desc);

alter table public.portal_views enable row level security;

-- Inserções públicas acontecem via cliente service-role na rota do portal
-- (o token na URL é a autenticação), que ignora RLS por design — o mesmo
-- modelo de confiança das restantes rotas públicas por token deste projeto.
-- Só é preciso política de leitura para os membros da agência lerem a
-- atividade dos seus próprios leads.
create policy "portal_views: own agency read" on public.portal_views
  for select using (exists (
    select 1 from public.leads l where l.id = portal_views.lead_id and l.agency_id = public.get_my_agency_id()
  ));
