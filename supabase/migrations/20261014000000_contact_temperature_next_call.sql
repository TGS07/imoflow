-- Pedidos do cliente (out/2026): temperatura do contacto, características,
-- próxima chamada, resultado das interações, estado de visitas dos imóveis e
-- novas opções de pipeline (contagem de dias, cor do border, ordenar por quentes).
-- Tudo aditivo: só colunas novas e checks alargados.

-- 1. Contactos
alter table public.people add column if not exists temperature text;
alter table public.people drop constraint if exists people_temperature_check;
alter table public.people add constraint people_temperature_check
  check (temperature is null or temperature in ('quente', 'neutro', 'frio'));

alter table public.people add column if not exists traits text[] not null default '{}';
alter table public.people add column if not exists next_call_at date;

-- 2. Resultado de cada interação (atendeu / não atendeu / whatsapp / enviado / respondido)
alter table public.contact_interactions add column if not exists outcome text;
alter table public.contact_interactions drop constraint if exists contact_interactions_outcome_check;
alter table public.contact_interactions add constraint contact_interactions_outcome_check
  check (outcome is null or outcome in ('atendeu', 'nao_atendeu', 'whatsapp', 'enviado', 'respondido'));

-- Classificar o histórico com as notas rápidas antigas
update public.contact_interactions set outcome = 'atendeu'
  where outcome is null and type = 'chamada' and note ilike 'Atendeu a chamada%';
update public.contact_interactions set outcome = 'nao_atendeu'
  where outcome is null and type = 'chamada'
    and (note ilike 'Não atendeu%' or note ilike 'Chamada foi para caixa de correio%');

create index if not exists contact_interactions_person_created_idx
  on public.contact_interactions (person_id, created_at desc);

-- 3. Imóveis: estado de visitas
alter table public.properties add column if not exists visit_activity text;
alter table public.properties drop constraint if exists properties_visit_activity_check;
alter table public.properties add constraint properties_visit_activity_check
  check (visit_activity is null or visit_activity in ('muitas', 'poucas', 'nenhuma'));

-- 4. Pipelines
alter table public.pipelines drop constraint if exists pipelines_card_sort_check;
alter table public.pipelines add constraint pipelines_card_sort_check
  check (card_sort in ('oldest_first', 'newest_first', 'hottest_first'));

alter table public.pipelines add column if not exists days_mode text not null default 'stage';
alter table public.pipelines drop constraint if exists pipelines_days_mode_check;
alter table public.pipelines add constraint pipelines_days_mode_check
  check (days_mode in ('stage', 'last_contact', 'both'));

alter table public.pipelines add column if not exists card_border_color text;
alter table public.pipelines drop constraint if exists pipelines_card_border_color_check;
alter table public.pipelines add constraint pipelines_card_border_color_check
  check (card_border_color is null or card_border_color ~ '^#[0-9A-Fa-f]{6}$');

-- Novo campo de card: características do contacto
alter table public.pipelines drop constraint if exists pipelines_card_primary_field_check;
alter table public.pipelines drop constraint if exists pipelines_card_secondary_field_check;
alter table public.pipelines add constraint pipelines_card_primary_field_check
  check (card_primary_field in ('name','phone','email','zone','typology','property','property_ref','property_type','value','call_status','source','notes','traits'));
alter table public.pipelines add constraint pipelines_card_secondary_field_check
  check (card_secondary_field in ('name','phone','email','zone','typology','property','property_ref','property_type','value','call_status','source','notes','traits'));
