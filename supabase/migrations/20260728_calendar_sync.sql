-- Sincronização seletiva de notificações com o calendário: toggle por
-- contacto/lead + feed ICS privado por utilizador. Ver
-- docs/superpowers/specs/2026-07-28-notificacoes-calendario-design.md.

alter table public.people add column calendar_sync_enabled boolean not null default false;
alter table public.leads  add column calendar_sync_enabled boolean not null default false;

-- Token opaco do feed ICS pessoal. Nunca é exposto a outros utilizadores;
-- só o próprio utilizador o vê/copia em /profile (ver
-- app/api/users/me/calendar-token/route.ts). Não incluir esta coluna em
-- selects amplos de `users` fora desse endpoint.
alter table public.users add column calendar_token uuid not null default gen_random_uuid();

-- Distingue atividades manuais de atividades espelhadas automaticamente a
-- partir de uma notificação (cron contact-followup / avisos de etapa via
-- lib/automations/engine.ts). notification_id evita duplicação ao
-- reexecutar os crons.
alter table public.activities
  add column source text not null default 'manual' check (source in ('manual', 'notification')),
  add column notification_id uuid references public.notifications(id) on delete cascade;

-- Rede de segurança contra corridas entre execuções do cron: garante que
-- nunca existe mais que uma activity por notification_id (o código já
-- verifica isto antes de inserir, isto é só a garantia ao nível da BD).
create unique index activities_notification_unique_idx
  on public.activities(notification_id) where notification_id is not null;
