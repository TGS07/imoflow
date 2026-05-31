-- automation_rules
CREATE TABLE public.automation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  trigger_type  TEXT NOT NULL CHECK (trigger_type IN (
                  'stage_changed', 'lead_created', 'activity_completed', 'lead_inactive'
                )),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_type   TEXT NOT NULL CHECK (action_type IN (
                  'create_activity', 'send_notification', 'move_stage'
                )),
  action_config  JSONB NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX automation_rules_agency_trigger_idx ON public.automation_rules(agency_id, trigger_type, is_active);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_rules: own agency" ON public.automation_rules
  FOR ALL USING (agency_id = public.get_my_agency_id());

-- automation_logs
CREATE TABLE public.automation_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  rule_id       UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  result        JSONB
);

CREATE INDEX automation_logs_rule_idx ON public.automation_logs(rule_id, triggered_at DESC);
CREATE INDEX automation_logs_lead_idx ON public.automation_logs(lead_id, triggered_at DESC);
CREATE INDEX automation_logs_agency_idx ON public.automation_logs(agency_id, triggered_at DESC);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_logs: own agency" ON public.automation_logs
  FOR ALL USING (agency_id = public.get_my_agency_id());

-- Seed data: regras pré-definidas (uma cópia por agência existente)
-- Nota: trigger_config usa "to_stage_name" para regras de stage, o engine resolve o ID em runtime
DO $$
DECLARE
  agency_rec RECORD;
BEGIN
  FOR agency_rec IN SELECT id FROM public.agencies LOOP
    INSERT INTO public.automation_rules (agency_id, name, description, trigger_type, trigger_config, action_type, action_config, is_active) VALUES
      (
        agency_rec.id,
        'Primeiro Contacto',
        'Quando uma nova lead é criada, agenda chamada de primeiro contacto',
        'lead_created',
        '{}',
        'create_activity',
        '{"activity_type": "chamada", "title": "Primeiro contacto", "due_days": 1}',
        true
      ),
      (
        agency_rec.id,
        'Preparar Proposta',
        'Quando lead avança para stage "Proposta", agenda envio de proposta por email',
        'stage_changed',
        '{"to_stage_name": "Proposta"}',
        'create_activity',
        '{"activity_type": "email", "title": "Enviar proposta", "due_days": 2}',
        true
      ),
      (
        agency_rec.id,
        'Agendar Visita',
        'Quando lead avança para stage "Visita", agenda visita ao imóvel',
        'stage_changed',
        '{"to_stage_name": "Visita"}',
        'create_activity',
        '{"activity_type": "visita", "title": "Agendar visita ao imóvel", "due_days": 3}',
        true
      ),
      (
        agency_rec.id,
        'Follow-up Pós-Atividade',
        'Quando uma atividade é concluída, agenda chamada de follow-up',
        'activity_completed',
        '{}',
        'create_activity',
        '{"activity_type": "chamada", "title": "Follow-up", "due_days": 2}',
        true
      ),
      (
        agency_rec.id,
        'Alerta de Inatividade (7 dias)',
        'Envia notificação quando lead está sem atividade há 7 dias',
        'lead_inactive',
        '{"inactive_days": 7}',
        'send_notification',
        '{"message": "Lead inativa há 7 dias sem atividade registada"}',
        true
      ),
      (
        agency_rec.id,
        'Mover para Frio (14 dias)',
        'Move lead para stage Frio quando está sem atividade há 14 dias',
        'lead_inactive',
        '{"inactive_days": 14}',
        'move_stage',
        '{"to_stage_name": "Frio"}',
        true
      );
  END LOOP;
END $$;
