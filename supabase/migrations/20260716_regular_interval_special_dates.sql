-- Frequência de follow-up personalizada por contacto/lead "regular": quando
-- preenchida, substitui os prazos globais da agência (followup_first_days /
-- followup_second_days) por um único intervalo em dias.
alter table public.people add column if not exists regular_interval_days int
  check (regular_interval_days is null or regular_interval_days > 0);
alter table public.leads add column if not exists regular_interval_days int
  check (regular_interval_days is null or regular_interval_days > 0);

-- Contacto especial: notifica em datas importantes (Natal, Páscoa,
-- aniversário e datas personalizadas), independente do estado "regular".
alter table public.people add column if not exists is_special boolean not null default false;
alter table public.people add column if not exists special_notify_christmas boolean not null default true;
alter table public.people add column if not exists special_notify_easter boolean not null default true;
alter table public.people add column if not exists special_notify_birthday boolean not null default true;
alter table public.people add column if not exists special_dates jsonb not null default '[]';

create index if not exists people_special_idx on public.people (agency_id) where is_special;

-- Novo tipo de notificação para datas especiais (distinto de task_due, que é
-- inatividade). Descobre o nome real da check constraint em vez de o
-- assumir, para não deixar a constraint antiga (sem 'special_date') ativa
-- em paralelo.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.notifications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%type%';

  if cname is not null then
    execute format('alter table public.notifications drop constraint %I', cname);
  end if;

  alter table public.notifications add constraint notifications_type_check
    check (type in ('new_lead','task_due','lead_stage_changed','email_received','special_date'));
end $$;
