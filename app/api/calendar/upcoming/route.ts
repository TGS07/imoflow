import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { matchSpecialDatesToday } from '@/lib/contacts/special-dates'
import { lisbonToIso, todayLisbon } from '@/lib/calendar/next-call-activity'

// Entradas PREVISTAS para o calendário (não gravadas na BD): o que vai
// acontecer nos próximos dias se nada mudar —
//  • "Falta contactar": contactos/leads regulares cujo prazo sem contacto
//    vence nesse dia (intervalo próprio ou 1.º/2.º prazo da agência);
//  • Datas especiais (Natal, Páscoa, aniversário, datas personalizadas).
// No próprio dia o cron contact-followup cria a notificação + entrada real,
// por isso aqui só entram datas a partir de amanhã.

export type ProjectedItem = {
  id: string
  type: 'chamada' | 'tarefa'
  title: string
  description: string
  due_date: string
  person?: { id: string; name: string }
  lead?: { id: string; name: string }
}

const DAY = 24 * 60 * 60 * 1000
const MAX_RANGE_DAYS = 62

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return new Date(d.getTime() + days * DAY).toISOString().slice(0, 10)
}

function lisbonDate(ts: string): string {
  return todayLisbon(new Date(ts))
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('agency_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const tomorrow = addDays(todayLisbon(), 1)
  const fromParam = searchParams.get('date_from')
  const toParam = searchParams.get('date_to')
  let from = fromParam ? lisbonDate(fromParam) : tomorrow
  if (from < tomorrow) from = tomorrow
  let to = toParam ? lisbonDate(toParam) : addDays(from, 31)
  if (to > addDays(from, MAX_RANGE_DAYS)) to = addDays(from, MAX_RANGE_DAYS)
  if (to < from) return NextResponse.json([])

  const inRange = (d: string) => d >= from && d <= to
  const items: ProjectedItem[] = []

  const { data: agency } = await supabase
    .from('agencies')
    .select('followup_first_days, followup_second_days')
    .eq('id', profile.agency_id)
    .single()
  const first = agency?.followup_first_days ?? 7
  const second = agency?.followup_second_days ?? 30

  // Datas em que o aviso "falta contactar" vai disparar, a partir da última referência.
  function dueDates(refDate: string, interval: number | null): { date: string; days: number }[] {
    const steps = interval != null ? [interval] : [first, second]
    return steps.map(n => ({ date: addDays(refDate, n), days: n }))
  }

  // --- Contactos regulares ---
  const { data: people } = await supabase
    .from('people')
    .select('id, name, last_interaction_at, created_at, regular_interval_days')
    .eq('agency_id', profile.agency_id)
    .eq('is_regular', true)
  for (const p of people ?? []) {
    const ref = lisbonDate(p.last_interaction_at ?? p.created_at)
    for (const { date, days } of dueDates(ref, p.regular_interval_days)) {
      if (!inRange(date)) continue
      items.push({
        id: `proj:fu:p:${p.id}:${date}`,
        type: 'chamada',
        title: `Falta contactar: ${p.name} (${days} dias sem contacto)`,
        description: `Previsto: se não houver contacto até lá, passam ${days} dias desde o último contacto com ${p.name}.`,
        due_date: lisbonToIso(date, '09:00'),
        person: { id: p.id, name: p.name },
      })
    }
  }

  // --- Leads regulares (abertas) ---
  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, created_at, regular_interval_days, pipeline_stages!inner(is_won, is_lost)')
    .eq('agency_id', profile.agency_id)
    .eq('is_regular', true)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)
  if (leads?.length) {
    const { data: acts } = await supabase
      .from('activities')
      .select('lead_id, created_at')
      .in('lead_id', leads.map(l => l.id))
      .order('created_at', { ascending: false })
    const last = new Map<string, string>()
    for (const a of acts ?? []) if (a.lead_id && !last.has(a.lead_id)) last.set(a.lead_id, a.created_at)
    for (const l of leads) {
      const ref = lisbonDate(last.get(l.id) ?? l.created_at)
      for (const { date, days } of dueDates(ref, l.regular_interval_days)) {
        if (!inRange(date)) continue
        items.push({
          id: `proj:fu:l:${l.id}:${date}`,
          type: 'chamada',
          title: `Falta contactar: ${l.name} (${days} dias sem contacto)`,
          description: `Previsto: se não houver atividade até lá, passam ${days} dias sem contacto com ${l.name}.`,
          due_date: lisbonToIso(date, '09:00'),
          lead: { id: l.id, name: l.name },
        })
      }
    }
  }

  // --- Datas especiais ---
  const { data: special } = await supabase
    .from('people')
    .select('id, name, birthday, special_notify_christmas, special_notify_easter, special_notify_birthday, special_dates')
    .eq('agency_id', profile.agency_id)
    .eq('is_special', true)
  if (special?.length) {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const day = new Date(`${d}T12:00:00Z`)
      for (const sp of special) {
        for (const match of matchSpecialDatesToday(sp, day)) {
          items.push({
            id: `proj:sd:${sp.id}:${d}:${match.label}`,
            type: 'tarefa',
            title: `${match.label}: ${sp.name}`,
            description: `Data especial de ${sp.name} — boa altura para dar uma palavra.`,
            due_date: lisbonToIso(d, '09:00'),
            person: { id: sp.id, name: sp.name },
          })
        }
      }
    }
  }

  return NextResponse.json(items)
}
