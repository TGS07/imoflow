import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { triggerAutomations } from '@/lib/automations/engine'

// Cron diário (ver vercel.json): avalia os avisos de etapa "X dias após
// entrar" e "recorrente a cada X dias" para todas as leads ativas,
// comparando com leads.stage_entered_at.
export async function GET(request: Request) { return handleCron(request) }
export async function POST(request: Request) { return handleCron(request) }

async function handleCron(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: rules } = await supabase
    .from('automation_rules')
    .select('id')
    .in('trigger_type', ['stage_days_after_entry', 'stage_recurring'])
    .eq('is_active', true)

  if (!rules || rules.length === 0) return NextResponse.json({ processed: 0 })

  const { data: leads } = await supabase
    .from('leads')
    .select('id, assigned_to, agency_id, stage_entered_at, pipeline_stages!inner(is_won, is_lost)')
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)

  if (!leads || leads.length === 0) return NextResponse.json({ processed: 0 })

  const now = Date.now()
  let processed = 0

  for (const lead of leads) {
    if (!lead.assigned_to || !lead.agency_id) continue

    const enteredAt = new Date(lead.stage_entered_at).getTime()
    const daysSinceStageEntry = Math.floor((now - enteredAt) / (24 * 60 * 60 * 1000))
    if (daysSinceStageEntry <= 0) continue

    for (const type of ['stage_days_after_entry', 'stage_recurring'] as const) {
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
