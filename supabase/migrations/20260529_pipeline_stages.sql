-- PIPELINE STAGES
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  color text not null default '#6B7280',
  position int not null default 0,
  probability int not null default 0 check (probability between 0 and 100),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now()
);

create index pipeline_stages_agency_idx on pipeline_stages(agency_id, position);

-- CUSTOM FIELDS
create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  field_type text not null check (field_type in ('text','number','date','select','multiselect','boolean','currency')),
  options jsonb,
  required boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index custom_fields_agency_idx on custom_fields(agency_id, position);

-- CUSTOM FIELD VALUES
create table public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  field_id uuid not null references public.custom_fields(id) on delete cascade,
  value_text text,
  value_number numeric,
  value_date date,
  value_json jsonb,
  created_at timestamptz not null default now(),
  unique(lead_id, field_id)
);

create index custom_field_values_lead_idx on custom_field_values(lead_id);

-- ADD NEW COLUMNS TO LEADS
alter table public.leads add column stage_id uuid references public.pipeline_stages(id);
alter table public.leads add column deal_value numeric;
alter table public.leads add column expected_close_date date;

-- SEED DEFAULT STAGES FOR EXISTING AGENCIES
do $$
declare
  agency record;
  stage_map jsonb;
begin
  for agency in select id from public.agencies loop
    with inserted as (
      insert into public.pipeline_stages (agency_id, name, color, position, probability, is_won, is_lost)
      values
        (agency.id, 'Lead',        '#3B82F6', 0, 10,  false, false),
        (agency.id, 'Visita',      '#F59E0B', 1, 30,  false, false),
        (agency.id, 'Proposta',    '#8B5CF6', 2, 50,  false, false),
        (agency.id, 'Negociação',  '#F97316', 3, 70,  false, false),
        (agency.id, 'Fechado',     '#10B981', 4, 100, true,  false),
        (agency.id, 'Perdido',     '#EF4444', 5, 0,   false, true)
      returning id, name
    )
    select jsonb_object_agg(
      case name
        when 'Lead' then 'lead'
        when 'Visita' then 'visita'
        when 'Proposta' then 'proposta'
        when 'Negociação' then 'negociacao'
        when 'Fechado' then 'fechado'
      end,
      id
    ) into stage_map
    from inserted
    where name != 'Perdido';

    update public.leads
    set stage_id = (stage_map ->> stage)::uuid
    where agency_id = agency.id and stage is not null;
  end loop;
end $$;

-- Make stage_id NOT NULL now that all leads are mapped
alter table public.leads alter column stage_id set not null;

-- Drop old stage column
alter table public.leads drop column stage;

-- RLS for pipeline_stages
alter table public.pipeline_stages enable row level security;
create policy "pipeline_stages: own agency" on public.pipeline_stages
  for all using (agency_id = public.get_my_agency_id());

-- RLS for custom_fields
alter table public.custom_fields enable row level security;
create policy "custom_fields: own agency" on public.custom_fields
  for all using (agency_id = public.get_my_agency_id());

-- RLS for custom_field_values
alter table public.custom_field_values enable row level security;
create policy "custom_field_values: own agency" on public.custom_field_values
  for all using (
    lead_id in (select id from public.leads where agency_id = public.get_my_agency_id())
  );
