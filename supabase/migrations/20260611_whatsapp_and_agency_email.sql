-- Remetente de email por agência
ALTER TABLE public.agencies
  ADD COLUMN email_from_name TEXT,
  ADD COLUMN email_reply_to TEXT;

-- Templates WhatsApp (espelha email_templates, sem subject)
CREATE TABLE public.whatsapp_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_templates_agency_idx ON public.whatsapp_templates(agency_id);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_templates: own agency" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (agency_id = public.get_my_agency_id())
  WITH CHECK (agency_id = public.get_my_agency_id());

-- Mensagens WhatsApp (Business API; inbound + outbound)
CREATE TABLE public.whatsapp_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID        REFERENCES public.agencies(id) ON DELETE CASCADE,
  lead_id       UUID        REFERENCES public.leads(id) ON DELETE CASCADE,
  direction     TEXT        NOT NULL CHECK (direction IN ('inbound','outbound')),
  phone         TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  wa_message_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_messages_lead_idx ON public.whatsapp_messages(lead_id);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_messages: own agency" ON public.whatsapp_messages
  FOR ALL TO authenticated
  USING (agency_id = public.get_my_agency_id());

-- Admins podem atualizar a própria agência (remetente de email)
CREATE POLICY "agencies: admin update own" ON public.agencies
  FOR UPDATE TO authenticated
  USING (id = public.get_my_agency_id())
  WITH CHECK (id = public.get_my_agency_id());
