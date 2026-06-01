CREATE TABLE public.email_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  subject    TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_templates_agency_idx ON public.email_templates(agency_id);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates: own agency" ON public.email_templates
  FOR ALL TO authenticated
  USING (agency_id = public.get_my_agency_id())
  WITH CHECK (agency_id = public.get_my_agency_id());
