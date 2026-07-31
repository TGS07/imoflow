-- supabase/migrations/20260731_user_theme.sql

alter table public.users
  add column if not exists theme text not null default 'light' check (theme in ('light', 'dark'));
