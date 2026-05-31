import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { triggerAutomations } from '@/lib/automations/engine'

// Este endpoint é chamado diariamente (ex: via Vercel Cron, GitHub Actions, etc.)
// Proteger com secret header para evitar chamadas não autorizadas
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Buscar regras de inatividade activas para saber os thresholds
  const { data: inactivityRules } = await supabase
    .from('automation_rules')
    .select('trigger_config')
    .eq('trigger_type', 'lead_inactive')
    .eq('is_active', true)

  if (!inactivityRules || inactivityRules.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  // Thresholds únicos de dias (ex: [7, 14])
  const thresholds = [...new Set(
    inactivityRules
      .map(r => Number((r.trigger_config as Record<string, unknown>).inactive_days ?? 0))
      .filter(d => d > 0)
  )]

  // Fetch all leads once (outside the thresholds loop)
  const { data: leads } = await supabase
    .from('leads')
    .select('id, assigned_to, agency_id, pipeline_stages!inner(is_won, is_lost)')
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)

  if (!leads || leads.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  // Fetch last activity date per lead in one query (avoid N+1)
  const leadIds = leads.map(l => l.id)
  const { data: recentActivities } = await supabase
    .from('activities')
    .select('lead_id, created_at')
    .in('lead_id', leadIds)
    .order('created_at', { ascending: false })

  // Build a map of lead_id -> last activity date
  const lastActivityMap = new Map<string, Date>()
  if (recentActivities) {
    for (const activity of recentActivities) {
      if (activity.lead_id && !lastActivityMap.has(activity.lead_id)) {
        lastActivityMap.set(activity.lead_id, new Date(activity.created_at))
      }
    }
  }

  let processed = 0

  // Now loop thresholds (no DB queries inside)
  for (const days of thresholds) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    for (const lead of leads) {
      if (!lead.assigned_to || !lead.agency_id) continue

      const lastDate = lastActivityMap.get(lead.id) ?? null
      const isInactive = !lastDate || lastDate <= cutoff

      if (!isInactive) continue

      await triggerAutomations({
        type: 'lead_inactive',
        leadId: lead.id,
        userId: lead.assigned_to,
        agencyId: lead.agency_id,
        meta: { inactiveDays: days },
      })

      processed++
    }
  }

  return NextResponse.json({ processed })
}
