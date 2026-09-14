-- Fase 7 (Onboarding): estado de onboarding por agência + bucket para logos.
-- Migration aditiva.

-- 1. Colunas de onboarding em agencies.
-- Adicionamos a coluna com DEFAULT true (para que agências já existentes
-- fiquem automaticamente marcadas como "onboarding concluído"), e só depois
-- baixamos o default para false, que passa a valer para novas agências
-- (criadas a partir daqui, portanto sem onboarding_completed definido no INSERT).
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT true;
ALTER TABLE public.agencies
  ALTER COLUMN onboarding_completed SET DEFAULT false;

-- onboarding_state: regista que passos opcionais do wizard já foram feitos,
-- ex.: {"agency": true, "pipeline": true, "contact": false, "team": false}
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS onboarding_state jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Storage bucket para logos de agência (público, max 2MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('agency-logos', 'agency-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- RLS policies para storage.objects — mesmo padrão de property-photos.
-- Ficheiros guardados sob <agency_id>/<filename>.

create policy "agency-logos: public read"
  on storage.objects
  for select
  using (bucket_id = 'agency-logos');

create policy "agency-logos: own agency insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'agency-logos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  );

create policy "agency-logos: own agency update"
  on storage.objects
  for update
  using (
    bucket_id = 'agency-logos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  )
  with check (
    bucket_id = 'agency-logos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  );

create policy "agency-logos: own agency delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'agency-logos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1]::uuid = public.get_my_agency_id()
  );
