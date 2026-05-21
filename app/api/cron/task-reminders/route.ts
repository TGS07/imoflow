import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

export async function GET(request: Request) {
  // Verificar token de autorização do Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const today = new Date()
  const dateStr = today.toISOString().split('T')[0]

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, assigned_to, lead_id, leads(agency_id)')
    .eq('due_date', dateStr)
    .neq('status', 'completed')

  if (error) {
    console.error('Cron: failed to fetch tasks:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let notified = 0
  for (const task of tasks ?? []) {
    const leadsData = task.leads as { agency_id: string } | { agency_id: string }[] | null
    const agencyId = Array.isArray(leadsData)
      ? leadsData[0]?.agency_id
      : leadsData?.agency_id
    if (!task.assigned_to || !agencyId) continue

    await createNotification({
      userId: task.assigned_to,
      agencyId,
      type: 'task_due',
      title: `Tarefa com prazo hoje: ${task.title}`,
      body: `A tarefa "${task.title}" vence hoje.`,
      link: task.lead_id ? `/leads/${task.lead_id}` : undefined,
    })
    notified++
  }

  return NextResponse.json({ notified })
}
