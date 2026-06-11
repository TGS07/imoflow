export type AutomationTriggerType =
  | 'stage_changed'
  | 'lead_created'
  | 'activity_completed'
  | 'lead_inactive'
  | 'whatsapp_message_received'

export type AutomationActionType =
  | 'create_activity'
  | 'send_notification'
  | 'move_stage'
  | 'send_email'
  | 'send_whatsapp'

export type AutomationRule = {
  id: string
  name: string
  description: string | null
  trigger_type: AutomationTriggerType
  trigger_config: Record<string, unknown>
  action_type: AutomationActionType
  action_config: Record<string, unknown>
  pipeline_id: string | null
  is_active: boolean
  created_at: string
}

export type AutomationLog = {
  id: string
  rule_id: string
  lead_id: string
  triggered_at: string
  status: 'success' | 'failed'
  result: Record<string, unknown> | null
  // joins opcionais
  automation_rules?: { name: string }
  leads?: { name: string }
}

export type AutomationEvent = {
  type: AutomationTriggerType
  leadId: string
  userId: string
  agencyId: string
  meta?: {
    toStageId?: string
    toStageName?: string
    pipelineId?: string
    activityId?: string
    inactiveDays?: number
    messageBody?: string
  }
}
