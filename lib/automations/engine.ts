import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { AutomationEvent, AutomationRule } from '@/types'
import { ActivityType } from '@/types/activity'
import { sendLeadEmail } from '@/lib/email/send'
import { fillVariables, TemplateVars } from '@/lib/email/variables'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'
import { normalizePhone } from '@/lib/whatsapp/utils'

// `client` permite passar o service client em contextos sem sessão (crons,
// webhooks) — sem ele, o RLS bloqueia as queries silenciosamente.
export async function triggerAutomations(event: AutomationEvent, client?: SupabaseClient): Promise<void> {
  const supabase = client ?? await createClient()

  // 1. Buscar regras activas para este trigger
  const { data: rules, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('trigger_type', event.type)
    .eq('is_active', true)
    .eq('agency_id', event.agencyId)

  if (error || !rules || rules.length === 0) return

  // 2. Filtrar por config do trigger
  const matchingRules = rules.filter((rule: AutomationRule) => {
    return matchesTriggerConfig(rule, event)
  })

  if (matchingRules.length === 0) return

  // 3. Buscar dados do lead
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, email, phone, assigned_to, agency_id, stage_id')
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
      result = await executeAction(rule, lead, assignedTo, agencyId, supabase)
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

type LeadData = {
  id: string
  name: string
  email: string | null
  phone: string | null
  assigned_to: string | null
  agency_id: string
  stage_id: string
}

async function buildTemplateVars(
  lead: LeadData,
  assignedTo: string,
  agencyId: string,
  supabase: SupabaseClient
): Promise<TemplateVars> {
  const [{ data: agent }, { data: agency }] = await Promise.all([
    supabase.from('users').select('name').eq('id', assignedTo).single(),
    supabase.from('agencies').select('name').eq('id', agencyId).single(),
  ])
  return {
    nome: lead.name,
    email: lead.email,
    telefone: lead.phone,
    agente: agent?.name,
    agencia: agency?.name,
  }
}

async function executeAction(
  rule: AutomationRule,
  lead: LeadData,
  assignedTo: string,
  agencyId: string,
  supabase: SupabaseClient
): Promise<Record<string, unknown>> {
  const config = rule.action_config as Record<string, unknown>
  const leadId = lead.id

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
    }, supabase)
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

  if (rule.action_type === 'send_email') {
    if (!lead.email) throw new Error('Lead não tem email')

    const templateId = config.template_id as string | undefined
    if (!templateId) throw new Error('Regra sem template de email configurado')

    const { data: template } = await supabase
      .from('email_templates')
      .select('subject, body')
      .eq('id', templateId)
      .single()

    if (!template) throw new Error('Template de email não encontrado')

    const vars = await buildTemplateVars(lead, assignedTo, agencyId, supabase)
    const result = await sendLeadEmail({
      supabase,
      leadId,
      agencyId,
      toEmail: lead.email,
      subject: fillVariables(template.subject, vars),
      body: fillVariables(template.body, vars),
      sentBy: assignedTo,
    })

    if (result.status === 'failed') {
      throw new Error(result.error ?? 'Erro ao enviar email')
    }
    return { email_sent_to: lead.email, template_id: templateId }
  }

  if (rule.action_type === 'send_whatsapp') {
    if (!lead.phone) throw new Error('Lead não tem telefone')

    const templateId = config.template_id as string | undefined
    if (!templateId) throw new Error('Regra sem template de WhatsApp configurado')

    const { data: template } = await supabase
      .from('whatsapp_templates')
      .select('body')
      .eq('id', templateId)
      .single()

    if (!template) throw new Error('Template de WhatsApp não encontrado')

    const vars = await buildTemplateVars(lead, assignedTo, agencyId, supabase)
    const body = fillVariables(template.body, vars)
    const phone = normalizePhone(lead.phone)

    const { waMessageId } = await sendWhatsAppMessage(phone, body)

    const { error: msgError } = await supabase.from('whatsapp_messages').insert({
      agency_id: agencyId,
      lead_id: leadId,
      direction: 'outbound',
      phone,
      body,
      wa_message_id: waMessageId,
    })
    if (msgError) console.error('Failed to log whatsapp message:', msgError.message)

    return { whatsapp_sent_to: phone, template_id: templateId }
  }

  throw new Error(`Action type desconhecido: ${rule.action_type}`)
}
