import { createServiceClient } from '@/lib/supabase/service'
import { buildIcsFeed } from '@/lib/calendar/ics'
import { NextResponse } from 'next/server'

const ICS_SUFFIX = '.ics'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  // calendar_token é uuid — um token mal formado nunca vai corresponder a
  // nenhuma linha; validamos aqui para devolver 404 em vez de deixar o
  // Postgres rejeitar o cast e a query devolver um erro real (500).
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = createServiceClient()

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('calendar_token', token)
    .maybeSingle()

  if (userError) {
    console.error('[calendar-feed] user lookup failed', userError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: activities, error: activitiesError } = await supabase
    .from('activities')
    .select('id, title, due_date, lead_id, person_id')
    .eq('source', 'notification')
    .eq('assigned_to', user.id)
    .not('due_date', 'is', null)

  if (activitiesError) {
    console.error('[calendar-feed] activities query failed', activitiesError)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  // `a.title` já inclui o nome do contacto/lead (ver os títulos construídos
  // em mirrorNotificationToCalendar nos chamadores: "Acompanhamento: <nome>",
  // "Etapa: <nome>", "<data especial>: <nome>") — não repetir o nome aqui.
  const events = (activities ?? []).map((a) => {
    const link = a.lead_id ? `/leads/${a.lead_id}` : a.person_id ? `/people/${a.person_id}` : ''
    return {
      id: a.id as string,
      title: a.title as string,
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
