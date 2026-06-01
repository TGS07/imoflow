CREATE TABLE public.web_forms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  fields      JSONB NOT NULL DEFAULT '["name","email","phone"]',
  stage_id    UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX web_forms_agency_idx ON public.web_forms(agency_id);

ALTER TABLE public.web_forms ENABLE ROW LEVEL SECURITY;

-- Utilizadores autenticados: CRUD da própria agência
CREATE POLICY "web_forms: own agency" ON public.web_forms
  FOR ALL TO authenticated USING (agency_id = public.get_my_agency_id());

-- Utilizadores anon: leitura de forms activos (para renderizar a página pública)
CREATE POLICY "web_forms: public read active" ON public.web_forms
  FOR SELECT TO anon USING (is_active = true);
