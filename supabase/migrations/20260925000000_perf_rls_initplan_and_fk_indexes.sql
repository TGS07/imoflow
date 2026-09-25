-- Performance: sem alterações de dados nem de regras de acesso.
--
-- 1) Políticas RLS: `get_my_agency_id()` / `auth.uid()` eram avaliadas uma vez
--    POR LINHA (a função é SECURITY DEFINER, não é inlined). Envolver em
--    `(select ...)` faz o Postgres avaliá-las uma única vez por query (initPlan).
--    A condição lógica de cada política mantém-se exatamente igual.
do $$
declare
  pol record;
  new_qual text;
  new_check text;
  stmt text;
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(get_my_agency_id\(\)|auth\.uid\(\))'
  loop
    new_qual := pol.qual;
    new_check := pol.with_check;
    if new_qual is not null and new_qual !~ 'SELECT get_my_agency_id\(\)|SELECT auth\.uid\(\)' then
      new_qual := replace(replace(new_qual, 'get_my_agency_id()', '(select get_my_agency_id())'), 'auth.uid()', '(select auth.uid())');
    end if;
    if new_check is not null and new_check !~ 'SELECT get_my_agency_id\(\)|SELECT auth\.uid\(\)' then
      new_check := replace(replace(new_check, 'get_my_agency_id()', '(select get_my_agency_id())'), 'auth.uid()', '(select auth.uid())');
    end if;

    stmt := format('alter policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    if new_qual is not null then stmt := stmt || format(' using (%s)', new_qual); end if;
    if new_check is not null then stmt := stmt || format(' with check (%s)', new_check); end if;
    execute stmt;
  end loop;
end $$;

-- 2) Índices em falta (FKs e filtros usados pela app)
create index if not exists leads_agency_created_idx on public.leads (agency_id, created_at desc);
create index if not exists leads_person_idx on public.leads (person_id);
create index if not exists leads_stage_idx on public.leads (stage_id);
create index if not exists leads_assigned_idx on public.leads (assigned_to);
create index if not exists leads_property_idx on public.leads (property_id);
create index if not exists leads_organization_idx on public.leads (organization_id);
create index if not exists users_agency_idx on public.users (agency_id);
create index if not exists people_assigned_idx on public.people (assigned_to);
create index if not exists activities_person_idx on public.activities (person_id);
create index if not exists contact_interactions_agency_idx on public.contact_interactions (agency_id);
create index if not exists contact_interactions_user_idx on public.contact_interactions (user_id);
create index if not exists tasks_lead_idx on public.tasks (lead_id);
create index if not exists tasks_assigned_idx on public.tasks (assigned_to);
create index if not exists contacts_lead_idx on public.contacts (lead_id);
create index if not exists emails_sent_lead_idx on public.emails_sent (lead_id);
create index if not exists custom_field_values_field_idx on public.custom_field_values (field_id);
create index if not exists notifications_agency_idx on public.notifications (agency_id);
create index if not exists property_visits_person_idx on public.property_visits (person_id);
create index if not exists idealista_matches_lead_idx on public.idealista_matches (lead_id);
