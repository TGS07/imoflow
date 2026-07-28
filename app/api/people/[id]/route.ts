import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type LeadWithStage = {
  id: string
  stage_id: string
  pipeline_stages?: { is_won: boolean; is_lost: boolean } | null
  [key: string]: unknown
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('people')
    .select(`*, leads(id, name, stage_id, pipeline_id, deal_value, expected_close_date, created_at, pipeline_stages(name, color, is_won, is_lost), pipelines(name)),
      properties_as_seller:properties!seller_id(id, title, status, price, reference),
      properties_as_buyer:properties!buyer_id(id, title, status, price, reference),
      property_consultants(id, properties(id, title, status, price, reference))`)
    .eq('id', id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  // Cadência efetiva de notificação (ver spec
  // 2026-07-28-cadencia-notificacao-contacto-design.md): para cada lead
  // ativo (etapa não ganha/perdida), expor o interval_days da regra
  // `stage_recurring` da etapa atual, se existir. Vai buscar todas as regras
  // `stage_recurring` ativas (RLS já restringe à agência do utilizador,
  // como o resto desta rota) e filtra em JS — mesmo padrão de
  // `matchesTriggerConfig` em lib/automations/engine.ts. Evita N+1: uma
  // query, não uma por lead.
  const leads = (data.leads ?? []) as LeadWithStage[]
  const activeStageIds = new Set(
    leads
      .filter(l => l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost)
      .map(l => l.stage_id)
  )

  const stageRecurringByStage = new Map<string, number>()
  if (activeStageIds.size > 0) {
    const { data: rules } = await supabase
      .from('automation_rules')
      .select('trigger_config')
      .eq('trigger_type', 'stage_recurring')
      .eq('is_active', true)
    for (const rule of rules ?? []) {
      const cfg = rule.trigger_config as Record<string, unknown>
      const stageId = cfg.stage_id as string | undefined
      const intervalDays = Number(cfg.interval_days ?? 0)
      if (stageId && activeStageIds.has(stageId) && intervalDays > 0) {
        stageRecurringByStage.set(stageId, intervalDays)
      }
    }
  }

  const leadsWithRecurring = leads.map(l => ({
    ...l,
    stage_recurring_days: stageRecurringByStage.get(l.stage_id) ?? null,
  }))

  return NextResponse.json({ ...data, leads: leadsWithRecurring })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowed = [
    'name', 'email', 'phone', 'address', 'notes', 'types', 'financial_capacity', 'source', 'details',
    'assigned_to', 'is_regular', 'birthday', 'regular_interval_days', 'calendar_sync_enabled',
    'is_special', 'special_notify_christmas', 'special_notify_easter', 'special_notify_birthday', 'special_dates',
  ] as const
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) update[k] = body[k]

  const { data, error } = await supabase
    .from('people')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
