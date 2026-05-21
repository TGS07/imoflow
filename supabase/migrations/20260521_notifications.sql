-- supabase/migrations/20260521_notifications.sql

-- Tabela de notificações
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  agency_id  uuid not null references agencies(id) on delete cascade,
  type       text not null check (type in ('new_lead','task_due','lead_stage_changed','email_received')),
  title      text not null,
  body       text not null,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on notifications(user_id, created_at desc);

-- Opt-out de email nas notificações
alter table users
  add column if not exists email_notifications boolean not null default true;
