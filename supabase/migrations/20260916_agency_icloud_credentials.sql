alter table public.agencies
  add column if not exists icloud_username text,
  add column if not exists icloud_app_password text;
