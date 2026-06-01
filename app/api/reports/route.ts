import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ReportsData, ReportPeriod } from '@/types'

function getCutoff(period: ReportPeriod): string {
  const now = new Date()
  switch (period) {
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
  const period = (searchParams.get('period') ?? '30d') as ReportPeriod
  const cutoff = getCutoff(period)

  const [
    leadsResult,
    funnelResult,
    sourceResult,
    timeResult,
    agentResult,
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('id, deal_value, pipeline_stages(is_won, is_lost)')
      .gte('created_at', cutoff),

    supabase
      .from('pipeline_stages')
      .select('id, name, position, leads(id)')
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

  const avgCloseDays: number | null = wonCount > 0 ? null : null

  // Funil
  const funnel = (funnelResult.data ?? []).map(stage => ({
    stage_id: stage.id,
    name: stage.name,
    position: stage.position,
    count: Array.isArray(stage.leads) ? stage.leads.length : 0,
  }))

  // Por fonte
  const sourceCounts = new Map<string, number>()
  for (const lead of (sourceResult.data ?? [])) {
    const src = (lead.source as string) ?? 'outro'
    sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1)
  }
  const by_source = [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  // Ao longo do tempo por semana
  const weekCounts = new Map<string, number>()
  for (const lead of (timeResult.data ?? [])) {
    const d = new Date(lead.created_at)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    const weekKey = d.toISOString().split('T')[0]
    weekCounts.set(weekKey, (weekCounts.get(weekKey) ?? 0) + 1)
  }
  const over_time = [...weekCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week_start, count]) => ({ week_start, count }))

  // Por agente
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
    by_source: by_source as unknown as ReportsData['by_source'],
    over_time,
    by_agent,
  }

  return NextResponse.json(result)
}
