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

  let processed = 0

  for (const days of thresholds) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    // Leads activas: excluir as que estão em stages is_won=true ou is_lost=true
    // A tabela leads usa stage_id -> pipeline_stages (is_won, is_lost)
    const { data: leads } = await supabase
      .from('leads')
      .select('id, assigned_to, agency_id, pipeline_stages!inner(is_won, is_lost)')
      .eq('pipeline_stages.is_won', false)
      .eq('pipeline_stages.is_lost', false)

    if (!leads) continue

    for (const lead of leads) {
      if (!lead.assigned_to || !lead.agency_id) continue

      // Verificar última atividade desta lead
      const { data: lastActivity } = await supabase
        .from('activities')
        .select('created_at, due_date')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const lastDate = lastActivity
        ? new Date(lastActivity.due_date ?? lastActivity.created_at)
        : null

      // Lead sem atividade, ou última atividade antes do cutoff
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
