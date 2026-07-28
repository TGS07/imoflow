import { createServiceClient } from '@/lib/supabase/service'
import { buildIcsFeed } from '@/lib/calendar/ics'
import { NextResponse } from 'next/server'

const ICS_SUFFIX = '.ics'

// Feed ICS privado por utilizador: GET /api/calendar/<token>.ics
// Sem sessão — o token na URL É a autenticação (padrão habitual para feeds
// de calendário privados, tal como Google/Apple Calendar). Âmbito: só as
// atividades do PRÓPRIO utilizador dono do token — mesmo padrão de
// GET /api/notifications, que filtra por user_id e não por agency_id.
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params
  if (!rawToken.endsWith(ICS_SUFFIX)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const token = rawToken.slice(0, -ICS_SUFFIX.length)

  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('calendar_token', token)
    .maybeSingle()

  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: activities } = await supabase
    .from('activities')
    .select('id, title, due_date, lead_id, person_id, leads(name), people(name)')
    .eq('source', 'notification')
    .eq('assigned_to', user.id)
    .not('due_date', 'is', null)

  const events = (activities ?? []).map((a) => {
    const target =
      (a.leads as unknown as { name: string } | null) ?? (a.people as unknown as { name: string } | null)
    const link = a.lead_id ? `/leads/${a.lead_id}` : a.person_id ? `/people/${a.person_id}` : ''
    return {
      id: a.id as string,
      title: target ? `${a.title}: ${target.name}` : (a.title as string),
      description: link ? `Ver no ImoFlow: https://app.imoflow.pt${link}` : 'Ver no ImoFlow',
      dueDate: a.due_date as string,
    }
  })

  const ics = buildIcsFeed(events)

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
