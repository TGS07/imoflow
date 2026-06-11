import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

// Chamado diariamente via Vercel Cron (GET). Usa o service client: em cron
// não há sessão e o RLS bloqueava as queries com o client normal.
export async function GET(request: Request) {
  // Verificar token de autorização do Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const today = new Date()
  const dateStr = today.toISOString().split('T')[0]
  const dayStart = `${dateStr}T00:00:00.000Z`
  const dayEnd = `${dateStr}T23:59:59.999Z`

  const { data: activities, error } = await supabase
    .from('activities')
    .select('id, title, assigned_to, lead_id, agency_id')
    .gte('due_date', dayStart)
    .lte('due_date', dayEnd)
    .eq('completed', false)

  if (error) {
    console.error('Cron: failed to fetch activities:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let notified = 0
  for (const activity of activities ?? []) {
    if (!activity.assigned_to || !activity.agency_id) continue

    await createNotification({
      userId: activity.assigned_to,
      agencyId: activity.agency_id,
      type: 'task_due',
      title: `Atividade com prazo hoje: ${activity.title}`,
      body: `A atividade "${activity.title}" vence hoje.`,
      link: activity.lead_id ? `/leads/${activity.lead_id}` : undefined,
    }, supabase)
    notified++
  }

  return NextResponse.json({ notified })
}
