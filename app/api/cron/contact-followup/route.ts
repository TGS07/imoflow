import { createServiceClient } from '@/lib/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'
import { daysSince, followupStatus } from '@/lib/contacts/followup'
import { matchSpecialDatesToday } from '@/lib/contacts/special-dates'

// Cron diário (ver vercel.json): para contactos e leads marcados como
// "regulares", avisa o responsável quando passam demasiados dias sem contacto
// (prazos da agência OU, se definido, o intervalo próprio do contacto/lead);
// e para contactos marcados como "especiais", avisa em datas importantes
// (Natal, Páscoa, aniversário, datas personalizadas).
//
// Deduplicação: cada lembrete dispara uma vez por período de silêncio.
// Guardamos uma marca em `notifications` (type + link + frase) e não
// repetimos dentro da janela correspondente.

export async function GET(request: Request) { return handle(request) }
export async function POST(request: Request) { return handle(request) }

// Já foi enviada uma notificação com esta frase para este link nos últimos
// `windowDays` dias? Usado tanto para follow-ups (janela = prazo) como para
// datas especiais (janela = 1 dia, evita duplicar no mesmo dia).
async function alreadyNotifiedRecently(
  supabase: SupabaseClient,
  userId: string,
  link: string,
  suffix: string,
  windowDays: number,
  now: number
): Promise<boolean> {
  const DAY = 24 * 60 * 60 * 1000
  const cutoff = new Date(now - windowDays * DAY).toISOString()
  const { data: recent } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('link', link)
    .like('body', `%${suffix}`)
    .gte('created_at', cutoff)
    .limit(1)
    .maybeSingle()
  return !!recent
}

async function handle(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = Date.now()

  // Prazos por agência
  const { data: agencies } = await supabase
    .from('agencies')
    .select('id, followup_first_days, followup_second_days')
  const prazos = new Map<string, { first: number; second: number }>()
  for (const a of agencies ?? []) {
    prazos.set(a.id, { first: a.followup_first_days ?? 7, second: a.followup_second_days ?? 30 })
  }

  // Fallback: um admin por agência, caso o item não tenha responsável
  const { data: admins } = await supabase.from('users').select('id, agency_id, role').eq('role', 'admin')
  const adminByAgency = new Map<string, string>()
  for (const a of admins ?? []) if (!adminByAgency.has(a.agency_id)) adminByAgency.set(a.agency_id, a.id)

  type Item = {
    kind: 'contacto' | 'lead'
    id: string
    name: string
    agency_id: string
    assigned_to: string | null
    intervalDays: number | null
    ref: number // timestamp da última referência de atividade
  }
  const items: Item[] = []

  // Contactos regulares
  const { data: people } = await supabase
    .from('people')
    .select('id, name, agency_id, assigned_to, last_interaction_at, created_at, regular_interval_days')
    .eq('is_regular', true)
  for (const p of people ?? []) {
    items.push({
      kind: 'contacto', id: p.id, name: p.name, agency_id: p.agency_id, assigned_to: p.assigned_to,
      intervalDays: p.regular_interval_days,
      ref: new Date(p.last_interaction_at ?? p.created_at).getTime(),
    })
  }

  // Leads regulares (não fechadas/perdidas) — inatividade pela última atividade
  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, agency_id, assigned_to, created_at, regular_interval_days, pipeline_stages!inner(is_won, is_lost)')
    .eq('is_regular', true)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)
  const leadIds = (leads ?? []).map(l => l.id)
  const lastActivity = new Map<string, number>()
  if (leadIds.length) {
    const { data: acts } = await supabase
      .from('activities')
      .select('lead_id, created_at')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false })
    for (const a of acts ?? []) {
      if (a.lead_id && !lastActivity.has(a.lead_id)) lastActivity.set(a.lead_id, new Date(a.created_at).getTime())
    }
  }
  for (const l of leads ?? []) {
    items.push({
      kind: 'lead', id: l.id, name: l.name, agency_id: l.agency_id, assigned_to: l.assigned_to,
      intervalDays: l.regular_interval_days,
      ref: lastActivity.get(l.id) ?? new Date(l.created_at).getTime(),
    })
  }

  let processed = 0

  // --- Follow-ups por inatividade (prazos da agência ou intervalo próprio) ---
  for (const it of items) {
    const p = prazos.get(it.agency_id) ?? { first: 7, second: 30 }
    const days = daysSince(new Date(it.ref), new Date(now))
    const status = followupStatus(days, it.intervalDays, p.first, p.second)
    if (!status.due || !status.windowDays) continue

    const userId = it.assigned_to ?? adminByAgency.get(it.agency_id)
    if (!userId) continue

    const link = it.kind === 'lead' ? `/leads/${it.id}` : `/people/${it.id}`

    // Cada tier tem uma frase própria (legível e única) usada também para
    // deduplicar: não repetimos o mesmo tier dentro da sua janela de dias.
    const suffix = status.tier === 2
      ? 'Prioridade: já passou bastante tempo, reativa este contacto.'
      : status.tier === 'custom'
        ? `Está na hora de um follow-up (intervalo definido: ${it.intervalDays} dias).`
        : 'Está na hora de um follow-up.'

    if (await alreadyNotifiedRecently(supabase, userId, link, suffix, status.windowDays, now)) continue

    const label = it.kind === 'lead' ? 'Lead' : 'Contacto'
    await createNotification({
      userId,
      agencyId: it.agency_id,
      type: 'task_due',
      title: `${label} a precisar de contacto: ${it.name}`,
      body: `Já não há contacto com ${it.name} há ${status.daysSince} dias. ${suffix}`,
      link,
    }, supabase)
    processed++
  }

  // --- Datas especiais (Natal, Páscoa, aniversário, personalizadas) ---
  const { data: specialPeople } = await supabase
    .from('people')
    .select('id, name, agency_id, assigned_to, birthday, special_notify_christmas, special_notify_easter, special_notify_birthday, special_dates')
    .eq('is_special', true)

  for (const sp of specialPeople ?? []) {
    const matches = matchSpecialDatesToday(sp, new Date(now))
    if (matches.length === 0) continue

    const userId = sp.assigned_to ?? adminByAgency.get(sp.agency_id)
    if (!userId) continue

    const link = `/people/${sp.id}`
    for (const match of matches) {
      const suffix = `${match.label}: ${sp.name}.`
      if (await alreadyNotifiedRecently(supabase, userId, link, suffix, 1, now)) continue

      const icon = match.label === 'Natal' ? '🎄' : match.label === 'Páscoa' ? '🐣' : match.label === 'Aniversário' ? '🎂' : '✦'
      await createNotification({
        userId,
        agencyId: sp.agency_id,
        type: 'special_date',
        title: `${icon} ${match.label} hoje: ${sp.name}`,
        body: `Hoje é uma data especial para ${sp.name}. ${suffix}`,
        link,
      }, supabase)
      processed++
    }
  }

  return NextResponse.json({ processed })
}
