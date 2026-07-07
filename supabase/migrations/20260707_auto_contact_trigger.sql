-- Garante que TODA a lead sem contacto ligado ganha um contacto automaticamente,
-- não importa por onde entra (app, formulário público, ou o bot do Idealista
-- a inserir diretamente na base de dados). Isto substitui a versão anterior
-- (lib/contacts/from-lead.ts), que só corria quando a lead passava pela app —
-- leads inseridas diretamente pelo bot nunca a acionavam.

create or replace function public.budget_to_capacity(budget numeric)
returns text
language sql
immutable
as $$
  select case
    when budget is null or budget <= 0 then null
    when budget < 250000 then 'muito_baixo'
    when budget < 500000 then 'baixo'
    when budget < 1000000 then 'medio'
    when budget < 2500000 then 'medio_alto'
    when budget < 5000000 then 'alto'
    else 'altissimo'
  end
$$;

create or replace function public.ensure_lead_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_person_id uuid;
begin
  if new.person_id is not null then
    return new;
  end if;

  insert into public.people (agency_id, name, email, phone, types, financial_capacity, source, details)
  values (
    new.agency_id, new.name, new.email, new.phone,
    array['comprador'],
    public.budget_to_capacity(new.budget),
    coalesce(new.source, 'outro'),
    jsonb_strip_nulls(jsonb_build_object('looking_for', new.typology, 'search_zone', new.zone))
  )
  returning id into new_person_id;

  new.person_id := new_person_id;
  return new;
end;
$$;

drop trigger if exists leads_ensure_contact on public.leads;
create trigger leads_ensure_contact
  before insert on public.leads
  for each row
  execute function public.ensure_lead_contact();

-- Corrigir leads já existentes sem contacto (mesma lógica, aplicada uma vez)
do $$
declare
  lead_row record;
  new_person_id uuid;
begin
  for lead_row in select * from public.leads where person_id is null loop
    insert into public.people (agency_id, name, email, phone, types, financial_capacity, source, details)
    values (
      lead_row.agency_id, lead_row.name, lead_row.email, lead_row.phone,
      array['comprador'],
      public.budget_to_capacity(lead_row.budget),
      coalesce(lead_row.source, 'outro'),
      jsonb_strip_nulls(jsonb_build_object('looking_for', lead_row.typology, 'search_zone', lead_row.zone))
    )
    returning id into new_person_id;

    update public.leads set person_id = new_person_id where id = lead_row.id;
  end loop;
end $$;
