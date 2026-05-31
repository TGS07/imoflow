import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { AutomationEvent, AutomationRule } from '@/types'
import { ActivityType } from '@/types/activity'

export async function triggerAutomations(event: AutomationEvent): Promise<void> {
  const supabase = await createClient()

  // 1. Buscar regras activas para este trigger
  const { data: rules, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('trigger_type', event.type)
    .eq('is_active', true)

  if (error || !rules || rules.length === 0) return

  // 2. Filtrar por pipeline se necessário (no agency context — rules already filtered by RLS)
  const matchingRules = rules.filter((rule: AutomationRule) => {
    return matchesTriggerConfig(rule, event)
  })

  if (matchingRules.length === 0) return

  // 3. Buscar dados do lead
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, assigned_to, agency_id, stage_id')
    .eq('id', event.leadId)
    .single()

  if (!lead) return

  const assignedTo = lead.assigned_to ?? event.userId
  const agencyId = lead.agency_id ?? event.agencyId

  // 4. Executar cada regra
  for (const rule of matchingRules) {
    // Deduplicação: não executar a mesma regra para o mesmo lead mais de uma vez por hora
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentLog } = await supabase
      .from('automation_logs')
      .select('id')
      .eq('rule_id', rule.id)
      .eq('lead_id', event.leadId)
      .gte('triggered_at', oneHourAgo)
      .limit(1)
      .maybeSingle()

    if (recentLog) continue

    let status: 'success' | 'failed' = 'success'
    let result: Record<string, unknown> = {}

    try {
      result = await executeAction(rule, event.leadId, assignedTo, agencyId, supabase)
    } catch (err) {
      status = 'failed'
      result = { error: err instanceof Error ? err.message : String(err) }
    }

    // 5. Registar log
    const { error: logError } = await supabase.from('automation_logs').insert({
      rule_id: rule.id,
      lead_id: event.leadId,
      agency_id: agencyId,
      status,
      result,
    })
    if (logError) {
      console.error('Failed to insert automation log:', logError.message)
    }
  }
}

function matchesTriggerConfig(rule: AutomationRule, event: AutomationEvent): boolean {
  // Filter by pipeline if rule is pipeline-specific
  if (rule.pipeline_id && rule.pipeline_id !== event.meta?.pipelineId) return false

  const config = rule.trigger_config as Record<string, unknown>

  if (rule.trigger_type === 'stage_changed') {
    if (config.to_stage_id && config.to_stage_id !== event.meta?.toStageId) return false
    if (config.to_stage_name && config.to_stage_name !== event.meta?.toStageName) return false
  }

  if (rule.trigger_type === 'lead_inactive') {
    const required = Number(config.inactive_days ?? 0)
    const actual = Number(event.meta?.inactiveDays ?? 0)
    if (actual < required) return false
  }

  return true
}

async function executeAction(
  rule: AutomationRule,
  leadId: string,
  assignedTo: string,
  agencyId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Record<string, unknown>> {
  const config = rule.action_config as Record<string, unknown>

  if (rule.action_type === 'create_activity') {
    const dueDays = Number(config.due_days ?? 1)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + dueDays)

    const { data: activity, error } = await supabase
      .from('activities')
      .insert({
        agency_id: agencyId,
        lead_id: leadId,
        assigned_to: assignedTo,
        type: (config.activity_type as ActivityType) ?? 'tarefa',
        title: String(config.title ?? 'Atividade automática'),
        due_date: dueDate.toISOString(),
        completed: false,
      })
      .select('id, title')
      .single()

    if (error) throw new Error(error.message)
    if (!activity) throw new Error('Atividade criada mas não retornada pelo servidor')
    return { created_activity_id: activity.id, title: activity.title }
  }

  if (rule.action_type === 'send_notification') {
    await createNotification({
      userId: assignedTo,
      agencyId,
      type: 'automation_rule_triggered',
      title: rule.name,
      body: String(config.message ?? rule.name),
      link: `/leads/${leadId}`,
    })
    return { notification_sent: true }
  }

  if (rule.action_type === 'move_stage') {
    let targetStageId = config.to_stage_id as string | undefined

    if (!targetStageId && config.to_stage_name) {
      const { data: stage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .ilike('name', String(config.to_stage_name))
        .limit(1)
        .single()

      targetStageId = stage?.id
    }

    if (!targetStageId) {
      throw new Error(`Stage "${config.to_stage_name ?? config.to_stage_id}" não encontrado`)
    }

    // NÃO chama triggerAutomations para evitar loops
    const { error } = await supabase
      .from('leads')
      .update({ stage_id: targetStageId })
      .eq('id', leadId)

    if (error) throw new Error(error.message)
    return { moved_to_stage_id: targetStageId }
  }

  throw new Error(`Action type desconhecido: ${rule.action_type}`)
}
