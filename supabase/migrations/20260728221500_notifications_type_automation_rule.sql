-- lib/automations/engine.ts já insere notificações com
-- type: 'automation_rule_triggered' (ação `send_notification` de uma regra
-- de automação, incluindo os avisos de etapa que docs/superpowers/specs/
-- 2026-07-28-notificacoes-calendario-design.md espelha no calendário), mas
-- esse valor nunca foi adicionado ao CHECK constraint de notifications.type
-- — cada inserção falhava silenciosamente (createNotification apanha o
-- erro e devolve null), pelo que os avisos de etapa nunca chegavam a criar
-- notificação nem, por consequência, a activity espelhada no calendário.
-- Mesmo padrão de reescrita dinâmica da constraint já usado em
-- 20260716_regular_interval_special_dates.sql.
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
    check (type in ('new_lead','task_due','lead_stage_changed','email_received','special_date','automation_rule_triggered'));
end $$;
