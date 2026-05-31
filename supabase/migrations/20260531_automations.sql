-- automation_rules
CREATE TABLE public.automation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  pipeline_id   UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX automation_rules_trigger_idx ON automation_rules(trigger_type, is_active);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_rules_read" ON automation_rules
  FOR SELECT USING (true);
CREATE POLICY "automation_rules_write" ON automation_rules
  FOR ALL USING (true) WITH CHECK (true);

-- automation_logs
CREATE TABLE public.automation_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  result        JSONB
);

CREATE INDEX automation_logs_rule_idx ON automation_logs(rule_id, triggered_at DESC);
CREATE INDEX automation_logs_lead_idx ON automation_logs(lead_id, triggered_at DESC);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_logs_read" ON automation_logs
  FOR SELECT USING (true);
CREATE POLICY "automation_logs_write" ON automation_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Seed data: regras pré-definidas
-- Nota: trigger_config usa "to_stage_name" para regras de stage, o engine resolve o ID em runtime
INSERT INTO automation_rules (name, description, trigger_type, trigger_config, action_type, action_config, is_active) VALUES
  (
    'Primeiro Contacto',
    'Quando uma nova lead é criada, agenda chamada de primeiro contacto',
    'lead_created',
    '{}',
    'create_activity',
    '{"activity_type": "chamada", "title": "Primeiro contacto", "due_days": 1}'
  ),
  (
    'Preparar Proposta',
    'Quando lead avança para stage "Proposta", agenda envio de proposta por email',
    'stage_changed',
    '{"to_stage_name": "Proposta"}',
    'create_activity',
    '{"activity_type": "email", "title": "Enviar proposta", "due_days": 2}'
  ),
  (
    'Agendar Visita',
    'Quando lead avança para stage "Visita", agenda visita ao imóvel',
    'stage_changed',
    '{"to_stage_name": "Visita"}',
    'create_activity',
    '{"activity_type": "visita", "title": "Agendar visita ao imóvel", "due_days": 3}'
  ),
  (
    'Follow-up Pós-Atividade',
    'Quando uma atividade é concluída, agenda chamada de follow-up',
    'activity_completed',
    '{}',
    'create_activity',
    '{"activity_type": "chamada", "title": "Follow-up", "due_days": 2}'
  ),
  (
    'Alerta de Inatividade (7 dias)',
    'Envia notificação quando lead está sem atividade há 7 dias',
    'lead_inactive',
    '{"inactive_days": 7}',
    'send_notification',
    '{"message": "Lead inativa há 7 dias sem atividade registada"}'
  ),
  (
    'Mover para Frio (14 dias)',
    'Move lead para stage Frio quando está sem atividade há 14 dias',
    'lead_inactive',
    '{"inactive_days": 14}',
    'move_stage',
    '{"to_stage_name": "Frio"}'
  );
