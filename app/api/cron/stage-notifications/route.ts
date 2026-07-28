import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { triggerAutomations } from '@/lib/automations/engine'

// Cron diário (ver vercel.json): avalia os avisos de etapa "X dias após
// entrar" e "recorrente a cada X dias" para todas as leads ativas,
// comparando com leads.stage_entered_at.
export async function GET(request: Request) { return handleCron(request) }
export async function POST(request: Request) { return handleCron(request) }

type StageRule = {
  id: string
  agency_id: string
  trigger_type: 'stage_days_after_entry' | 'stage_recurring'
  trigger_config: Record<string, unknown>
}

// Pré-verificação barata: replica (de forma simplificada) a lógica de
// matchesTriggerConfig em lib/automations/engine.ts, só para decidir se vale
// a pena chamar triggerAutomations (que faz a query real e é a fonte de
// verdade). Evita uma chamada+query por lead/tipo quando nenhuma regra da
// agência pode sequer corresponder.
function ruleMatchesLead(rule: StageRule, stageId: string | null, daysSinceStageEntry: number): boolean {
  const cfgStageId = rule.trigger_config.stage_id
  if (cfgStageId && cfgStageId !== stageId) return false

  if (rule.trigger_type === 'stage_days_after_entry') {
    const days = Number(rule.trigger_config.days ?? 0)
    return days > 0 && days === daysSinceStageEntry
  }

  // stage_recurring
  const intervalDays = Number(rule.trigger_config.interval_days ?? 0)
  return intervalDays > 0 && daysSinceStageEntry > 0 && daysSinceStageEntry % intervalDays === 0
}

async function handleCron(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: rules } = await supabase
    .from('automation_rules')
    .select('id, agency_id, trigger_type, trigger_config')
    .in('trigger_type', ['stage_days_after_entry', 'stage_recurring'])
    .eq('is_active', true)

  if (!rules || rules.length === 0) return NextResponse.json({ processed: 0 })

  // Agrupar regras por agência para lookup barato por lead.
  const rulesByAgency = new Map<string, StageRule[]>()
  for (const rule of rules as StageRule[]) {
    const agencyRules = rulesByAgency.get(rule.agency_id) ?? []
    agencyRules.push(rule)
    rulesByAgency.set(rule.agency_id, agencyRules)
  }

  const { data: leads } = await supabase
    .from('leads')
    .select('id, assigned_to, agency_id, stage_id, stage_entered_at, person_id, pipeline_stages!inner(is_won, is_lost)')
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)

  if (!leads || leads.length === 0) return NextResponse.json({ processed: 0 })

  // Contactos com ritmo próprio definido: a cadência recorrente da etapa não
  // se aplica às leads desses contactos (ver spec
  // 2026-07-28-cadencia-notificacao-contacto-design.md) — só o aviso
  // "stage_recurring" é suprimido; os outros três (entrada, parado há X
  // dias, X dias após entrada) continuam a disparar normalmente. Uma única
  // query para todos os person_id envolvidos (mesmo padrão de
  // app/api/cron/contact-followup/route.ts), para evitar N+1.
  const personIds = [...new Set(leads.map(l => l.person_id).filter((p): p is string => !!p))]
  const regularPersonIds = new Set<string>()
  if (personIds.length > 0) {
    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('id, is_regular, regular_interval_days')
      .in('id', personIds)
    if (peopleError) console.error('stage-notifications: failed to fetch people cadence:', peopleError.message)
    for (const p of people ?? []) {
      if (p.is_regular && p.regular_interval_days != null) regularPersonIds.add(p.id)
    }
  }

  const now = Date.now()
  let processed = 0

  for (const lead of leads) {
    if (!lead.assigned_to || !lead.agency_id) continue

    const agencyRules = rulesByAgency.get(lead.agency_id)
    if (!agencyRules || agencyRules.length === 0) continue

    const enteredAt = new Date(lead.stage_entered_at).getTime()
    const daysSinceStageEntry = Math.floor((now - enteredAt) / (24 * 60 * 60 * 1000))
    if (daysSinceStageEntry <= 0) continue

    const hasOwnCadence = !!lead.person_id && regularPersonIds.has(lead.person_id)

    for (const type of ['stage_days_after_entry', 'stage_recurring'] as const) {
      if (type === 'stage_recurring' && hasOwnCadence) continue

      const hasPlausibleMatch = agencyRules.some(
        rule => rule.trigger_type === type && ruleMatchesLead(rule, lead.stage_id, daysSinceStageEntry)
      )
      if (!hasPlausibleMatch) continue

      await triggerAutomations({
        type,
        leadId: lead.id,
        userId: lead.assigned_to,
        agencyId: lead.agency_id,
        meta: { daysSinceStageEntry },
      }, supabase)
      processed++
    }
  }

  return NextResponse.json({ processed })
}
