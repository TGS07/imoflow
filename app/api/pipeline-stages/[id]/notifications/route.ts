import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Avisos por etapa, guardados como regras normais de automação:
// - "ao entrar":  trigger stage_changed + trigger_config.to_stage_id
// - "parado Xd":  trigger lead_inactive + trigger_config.{stage_id, inactive_days}
// Ambas com action send_notification (responsável da lead). O editor por
// etapa é o dono destas regras: desligar um toggle APAGA a regra
// (automation_logs.rule_id tem on delete cascade).

type StageNotificationsState = { on_enter: boolean; stale_days: number | null }

async function getStage(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('users').select('agency_id').eq('id', user.id).single()
  if (!profile) return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id, name, pipeline_id, agency_id')
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .single()
  if (!stage) return { error: NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 }) }
  return { stage, agencyId: profile.agency_id }
}

async function readState(supabase: Awaited<ReturnType<typeof createClient>>, agencyId: string, stageId: string) {
  const [{ data: enterRules }, { data: staleRules }] = await Promise.all([
    supabase.from('automation_rules').select('id, is_active')
      .eq('agency_id', agencyId)
      .eq('trigger_type', 'stage_changed')
      .eq('trigger_config->>to_stage_id', stageId),
    supabase.from('automation_rules').select('id, is_active, trigger_config')
      .eq('agency_id', agencyId)
      .eq('trigger_type', 'lead_inactive')
      .eq('trigger_config->>stage_id', stageId),
  ])
  const enter = (enterRules ?? []).find(r => r.is_active)
  const stale = (staleRules ?? []).find(r => r.is_active)
  const staleDays = stale ? Number((stale.trigger_config as Record<string, unknown>).inactive_days ?? 0) || null : null
  return {
    state: { on_enter: !!enter, stale_days: staleDays } satisfies StageNotificationsState,
    enterRuleIds: (enterRules ?? []).map(r => r.id),
    staleRuleIds: (staleRules ?? []).map(r => r.id),
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const res = await getStage(supabase, id)
  if ('error' in res) return res.error
  const { state } = await readState(supabase, res.agencyId, id)
  return NextResponse.json(state)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const res = await getStage(supabase, id)
  if ('error' in res) return res.error
  const { stage, agencyId } = res

  const body = await request.json().catch(() => ({}))
  const onEnter = body.on_enter === true
  const staleDays = Number.isInteger(body.stale_days) && body.stale_days >= 1 ? body.stale_days as number : null
  if (body.stale_days != null && staleDays == null) {
    return NextResponse.json({ error: 'stale_days tem de ser um inteiro ≥ 1' }, { status: 400 })
  }

  const { enterRuleIds, staleRuleIds } = await readState(supabase, agencyId, id)

  // Sincronizar "ao entrar"
  if (onEnter) {
    const row = {
      name: `Etapa ${stage.name}: aviso de entrada`,
      trigger_config: { to_stage_id: id },
      action_config: { message: `Um contacto entrou na etapa "${stage.name}".` },
      is_active: true,
    }
    if (enterRuleIds.length === 0) {
      const { error } = await supabase.from('automation_rules').insert({
        agency_id: agencyId,
        description: 'Criado pelo editor de notificações da etapa',
        trigger_type: 'stage_changed',
        action_type: 'send_notification',
        pipeline_id: stage.pipeline_id,
        ...row,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from('automation_rules').update(row).in('id', enterRuleIds)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (enterRuleIds.length > 0) {
    const { error } = await supabase.from('automation_rules').delete().in('id', enterRuleIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Sincronizar "parado há X dias"
  if (staleDays != null) {
    const row = {
      name: `Etapa ${stage.name}: parado ${staleDays} dias`,
      trigger_config: { stage_id: id, inactive_days: staleDays },
      action_config: { message: `Um contacto está há ${staleDays} dias sem atividade na etapa "${stage.name}".` },
      is_active: true,
    }
    if (staleRuleIds.length === 0) {
      const { error } = await supabase.from('automation_rules').insert({
        agency_id: agencyId,
        description: 'Criado pelo editor de notificações da etapa',
        trigger_type: 'lead_inactive',
        action_type: 'send_notification',
        pipeline_id: stage.pipeline_id,
        ...row,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from('automation_rules').update(row).in('id', staleRuleIds)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (staleRuleIds.length > 0) {
    const { error } = await supabase.from('automation_rules').delete().in('id', staleRuleIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { state } = await readState(supabase, agencyId, id)
  return NextResponse.json(state)
}
