-- Ligações externas de leads: um parceiro (formulários do Instagram, sites,
-- Make/Zapier…) envia um POST para /api/inbound/leads com a chave secreta e a
-- lead entra direto na pipeline/fase escolhida. Uma linha por parceiro, para
-- poder revogar a chave de cada um sem afetar os outros.

create table if not exists public.lead_webhooks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  token text not null unique,
  pipeline_id uuid references public.pipelines(id) on delete set null,
  stage_id uuid references public.pipeline_stages(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  is_active boolean not null default true,
  lead_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lead_webhooks_agency_idx on public.lead_webhooks (agency_id);

alter table public.lead_webhooks enable row level security;

-- Só administradores da própria agência (a chave é secreta). O endpoint
-- público usa a service role para procurar a chave.
drop policy if exists "lead_webhooks: agency admins" on public.lead_webhooks;
create policy "lead_webhooks: agency admins" on public.lead_webhooks
  for all to authenticated
  using (
    agency_id = (select public.get_my_agency_id())
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'admin')
  )
  with check (
    agency_id = (select public.get_my_agency_id())
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'admin')
  );
