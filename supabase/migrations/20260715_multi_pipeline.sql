-- Múltiplas pipelines por agência.

-- 1. Tabela pipelines
create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists pipelines_agency_idx on public.pipelines(agency_id, position);
alter table public.pipelines enable row level security;

-- RLS: mesma agência (espelha o padrão das outras tabelas)
drop policy if exists "pipelines: own agency" on public.pipelines;
create policy "pipelines: own agency" on public.pipelines
  for all using (agency_id = public.get_my_agency_id());

-- 2. pipeline_id em pipeline_stages e leads
alter table public.pipeline_stages add column if not exists pipeline_id uuid references public.pipelines(id) on delete cascade;
alter table public.leads add column if not exists pipeline_id uuid references public.pipelines(id) on delete set null;
create index if not exists pipeline_stages_pipeline_idx on public.pipeline_stages(pipeline_id, position);
create index if not exists leads_pipeline_idx on public.leads(pipeline_id);

-- 3. Seed por agência: Leads (reaproveita etapas/leads existentes) +
--    Vendedores e Compradores (etapas novas, vazias).
do $$
declare
  ag record;
  leads_pid uuid;
  vend_pid uuid;
  comp_pid uuid;
begin
  for ag in select id from public.agencies loop
    -- Pipeline "Leads" (pos 0) — só se ainda não houver nenhuma pipeline
    if not exists (select 1 from public.pipelines where agency_id = ag.id) then
      insert into public.pipelines (agency_id, name, position)
        values (ag.id, 'Leads', 0) returning id into leads_pid;

      -- Etapas e leads existentes passam a pertencer à pipeline Leads
      update public.pipeline_stages set pipeline_id = leads_pid
        where agency_id = ag.id and pipeline_id is null;
      update public.leads set pipeline_id = leads_pid
        where agency_id = ag.id and pipeline_id is null;

      -- Pipeline "Vendedores" (pos 1)
      insert into public.pipelines (agency_id, name, position)
        values (ag.id, 'Vendedores', 1) returning id into vend_pid;
      insert into public.pipeline_stages (agency_id, pipeline_id, name, color, position, probability, is_won, is_lost) values
        (ag.id, vend_pid, 'Contacto',     '#3B82F6', 0, 10,  false, false),
        (ag.id, vend_pid, 'Angariação',   '#F59E0B', 1, 30,  false, false),
        (ag.id, vend_pid, 'Avaliação',    '#8B5CF6', 2, 45,  false, false),
        (ag.id, vend_pid, 'Em promoção',  '#14B8A6', 3, 60,  false, false),
        (ag.id, vend_pid, 'Proposta',     '#F97316', 4, 80,  false, false),
        (ag.id, vend_pid, 'Vendido',      '#10B981', 5, 100, true,  false),
        (ag.id, vend_pid, 'Perdido',      '#EF4444', 6, 0,   false, true);

      -- Pipeline "Compradores" (pos 2)
      insert into public.pipelines (agency_id, name, position)
        values (ag.id, 'Compradores', 2) returning id into comp_pid;
      insert into public.pipeline_stages (agency_id, pipeline_id, name, color, position, probability, is_won, is_lost) values
        (ag.id, comp_pid, 'Contacto',     '#3B82F6', 0, 10,  false, false),
        (ag.id, comp_pid, 'Qualificação', '#F59E0B', 1, 30,  false, false),
        (ag.id, comp_pid, 'Visitas',      '#8B5CF6', 2, 50,  false, false),
        (ag.id, comp_pid, 'Proposta',     '#F97316', 3, 70,  false, false),
        (ag.id, comp_pid, 'Negociação',   '#EC4899', 4, 85,  false, false),
        (ag.id, comp_pid, 'Fechado',      '#10B981', 5, 100, true,  false),
        (ag.id, comp_pid, 'Perdido',      '#EF4444', 6, 0,   false, true);
    end if;
  end loop;
end $$;

-- 4. Trigger: garante pipeline_id/stage_id coerentes em qualquer inserção de lead
create or replace function public.ensure_lead_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pipeline_id is null then
    if new.stage_id is not null then
      select pipeline_id into new.pipeline_id from public.pipeline_stages where id = new.stage_id;
    end if;
    if new.pipeline_id is null then
      select id into new.pipeline_id from public.pipelines
        where agency_id = new.agency_id order by position asc limit 1;
    end if;
  end if;
  if new.stage_id is null and new.pipeline_id is not null then
    select id into new.stage_id from public.pipeline_stages
      where pipeline_id = new.pipeline_id order by position asc limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_ensure_pipeline on public.leads;
create trigger leads_ensure_pipeline
  before insert on public.leads
  for each row
  execute function public.ensure_lead_pipeline();
