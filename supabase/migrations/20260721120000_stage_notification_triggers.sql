-- Novos trigger_type para avisos de etapa: X dias após entrar / recorrente a cada X dias
ALTER TABLE public.automation_rules DROP CONSTRAINT automation_rules_trigger_type_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_trigger_type_check
  CHECK (trigger_type IN (
    'stage_changed', 'lead_created', 'activity_completed', 'lead_inactive',
    'whatsapp_message_received', 'stage_days_after_entry', 'stage_recurring'
  ));

-- Necessário para calcular "dias na etapa atual" (não existia nenhum registo disto)
ALTER TABLE public.leads ADD COLUMN stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE public.leads SET stage_entered_at = created_at;
