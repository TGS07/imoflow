-- Calendário com tudo: todas as notificações passam a ser espelhadas como
-- atividades (sem depender de calendar_sync_enabled) e a "próxima chamada"
-- agendada num contacto vira logo uma atividade 'chamada' no dia/hora.

-- As notificações são podadas a 20 por utilizador (lib/notifications.ts). Com
-- ON DELETE CASCADE a poda apagava também a entrada do calendário. Passamos a
-- SET NULL: a atividade fica, só perde a ligação à notificação original.
alter table public.activities drop constraint activities_notification_id_fkey;
alter table public.activities
  add constraint activities_notification_id_fkey
  foreign key (notification_id) references public.notifications(id) on delete set null;

-- Nova origem 'next_call': atividade criada ao agendar a próxima chamada.
alter table public.activities drop constraint activities_source_check;
alter table public.activities
  add constraint activities_source_check
  check (source in ('manual', 'notification', 'next_call'));

create index if not exists activities_open_next_call_idx
  on public.activities(person_id)
  where source = 'next_call' and completed = false;
