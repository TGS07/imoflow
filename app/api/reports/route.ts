import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ReportsData, ReportPeriod, LeadSource } from '@/types'

function getCutoff(period: ReportPeriod): string {
  const now = new Date()
  switch (period) {
    case '7d': now.setDate(now.getDate() - 7); break
    case '30d': now.setDate(now.getDate() - 30); break
    case '90d': now.setDate(now.getDate() - 90); break
    case '6m': now.setMonth(now.getMonth() - 6); break
    case '1y': now.setFullYear(now.getFullYear() - 1); break
  }
  return now.toISOString()
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)

  const VALID_PERIODS: ReportPeriod[] = ['7d', '30d', '90d', '6m', '1y']
  const rawPeriod = searchParams.get('period') ?? '30d'
  if (!VALID_PERIODS.includes(rawPeriod as ReportPeriod)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }
  const period = rawPeriod as ReportPeriod

  const cutoff = getCutoff(period)

  // Isolamento de agência garantido via RLS (get_my_agency_id()) nas policies do Supabase
  try {
    const [
      leadsResult,
      funnelResult,
      sourceResult,
      timeResult,
      agentResult,
    ] = await Promise.all([
      supabase
        .from('leads')
        .select('id, stage_id, deal_value, pipeline_stages(is_won, is_lost)')
        .gte('created_at', cutoff),

      // Fetch stages separately; lead counts are computed in memory from period-filtered leads
      supabase
        .from('pipeline_stages')
        .select('id, name, position')
        .order('position', { ascending: true }),

      supabase
        .from('leads')
        .select('source')
        .gte('created_at', cutoff),

      supabase
        .from('leads')
        .select('created_at')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true }),

      supabase
        .from('leads')
        .select('assigned_to, users(id, name), pipeline_stages(is_won)')
        .gte('created_at', cutoff)
        .not('assigned_to', 'is', null),
    ])

    if (leadsResult.error) throw leadsResult.error
    if (funnelResult.error) throw funnelResult.error
    if (sourceResult.error) throw sourceResult.error
    if (timeResult.error) throw timeResult.error
    if (agentResult.error) throw agentResult.error

    // KPIs
    const leads = leadsResult.data ?? []
    const totalLeads = leads.length
    const wonLeads = leads.filter(l => {
      const ps = l.pipeline_stages as unknown as { is_won: boolean } | null
      return ps?.is_won === true
    })
    const wonCount = wonLeads.length
    const conversionRate = totalLeads > 0
      ? Math.round((wonCount / totalLeads) * 1000) / 10
      : 0

    const pipelineValue = leads.reduce((sum, l) => {
      const ps = l.pipeline_stages as unknown as { is_lost: boolean } | null
      if (ps?.is_lost) return sum
      return sum + (Number(l.deal_value) || 0)
    }, 0)

    // avg_close_days reserved for future implementation
    // (requires won_at field on leads table, not yet in schema)
    const avgCloseDays: number | null = null

    // Compute funnel in memory using period-filtered leads
    const stageCountMap = new Map<string, number>()
    const stageValueMap = new Map<string, number>()
    for (const lead of leads) {
      const stageId = (lead as unknown as { stage_id: string }).stage_id
      if (!stageId) continue
      stageCountMap.set(stageId, (stageCountMap.get(stageId) ?? 0) + 1)
      const dealValue = Number((lead as unknown as { deal_value: number | null }).deal_value) || 0
      stageValueMap.set(stageId, (stageValueMap.get(stageId) ?? 0) + dealValue)
    }

    const funnel = (funnelResult.data ?? []).map(stage => ({
      stage_id: stage.id,
      name: stage.name,
      position: stage.position,
      count: stageCountMap.get(stage.id) ?? 0,
      value: stageValueMap.get(stage.id) ?? 0,
    }))

    // Por fonte
    const VALID_SOURCES = new Set<string>(['site', 'instagram', 'facebook', 'referencia', 'outro'])
    const sourceCounts = new Map<LeadSource, number>()
    for (const lead of (sourceResult.data ?? [])) {
      const src: LeadSource = VALID_SOURCES.has(lead.source as string)
        ? lead.source as LeadSource
        : 'outro' as LeadSource
      sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1)
    }
    const by_source: ReportsData['by_source'] = [...sourceCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)

    // Ao longo do tempo por semana (agrupado por início de semana em UTC)
    const weekCounts = new Map<string, number>()
    for (const lead of (timeResult.data ?? [])) {
      const d = new Date(lead.created_at)
      const day = d.getUTCDay()
      const diff = day === 0 ? -6 : 1 - day
      d.setUTCDate(d.getUTCDate() + diff)
      d.setUTCHours(0, 0, 0, 0)
      const weekKey = d.toISOString().split('T')[0]
      weekCounts.set(weekKey, (weekCounts.get(weekKey) ?? 0) + 1)
    }
    const over_time = [...weekCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week_start, count]) => ({ week_start, count }))

    // Por agente
    // won_count: leads criados no período cujo stage atual é is_won.
    // Nota: não equivale a "fechados no período" pois não existe campo won_at no schema.
    const agentMap = new Map<string, { name: string; count: number }>()
    for (const lead of (agentResult.data ?? [])) {
      const ps = lead.pipeline_stages as unknown as { is_won: boolean } | null
      if (!ps?.is_won) continue
      const userId = lead.assigned_to as string
      const userName = (lead.users as unknown as { name: string } | null)?.name ?? 'Desconhecido'
      const existing = agentMap.get(userId)
      if (existing) {
        existing.count++
      } else {
        agentMap.set(userId, { name: userName, count: 1 })
      }
    }
    const by_agent = [...agentMap.entries()]
      .map(([user_id, { name, count }]) => ({ user_id, name, won_count: count }))
      .sort((a, b) => b.won_count - a.won_count)

    const result: ReportsData = {
      kpis: {
        total_leads: totalLeads,
        won_leads: wonCount,
        conversion_rate: conversionRate,
        pipeline_value: pipelineValue,
        avg_close_days: avgCloseDays,
      },
      funnel,
      by_source,
      over_time,
      by_agent,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[reports] query failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
