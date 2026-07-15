import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

// Cron diário (ver vercel.json): para contactos e leads marcados como
// "regulares", avisa o responsável quando passam demasiados dias sem contacto.
// Cada agência define os prazos (followup_first_days / followup_second_days).
//
// Deduplicação: cada lembrete (1º / 2º) dispara uma vez por período de
// silêncio. Guardamos uma marca em `notifications` (type + link) e não
// repetimos dentro da janela de dias correspondente. Quando há novo contacto,
// a referência de inatividade avança e o ciclo recomeça.

export async function GET(request: Request) { return handle(request) }
export async function POST(request: Request) { return handle(request) }

async function handle(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000

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
    ref: number // timestamp da última referência de atividade
  }
  const items: Item[] = []

  // Contactos regulares
  const { data: people } = await supabase
    .from('people')
    .select('id, name, agency_id, assigned_to, last_interaction_at, created_at')
    .eq('is_regular', true)
  for (const p of people ?? []) {
    items.push({
      kind: 'contacto', id: p.id, name: p.name, agency_id: p.agency_id, assigned_to: p.assigned_to,
      ref: new Date(p.last_interaction_at ?? p.created_at).getTime(),
    })
  }

  // Leads regulares (não fechadas/perdidas) — inatividade pela última atividade
  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, agency_id, assigned_to, created_at, pipeline_stages!inner(is_won, is_lost)')
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
      ref: lastActivity.get(l.id) ?? new Date(l.created_at).getTime(),
    })
  }

  let processed = 0
  for (const it of items) {
    const p = prazos.get(it.agency_id) ?? { first: 7, second: 30 }
    const daysSince = Math.floor((now - it.ref) / DAY)
    // Qual lembrete se aplica? (o 2º tem prioridade sobre o 1º)
    let tier: 1 | 2 | null = null
    if (daysSince >= p.second) tier = 2
    else if (daysSince >= p.first) tier = 1
    if (!tier) continue

    const userId = it.assigned_to ?? adminByAgency.get(it.agency_id)
    if (!userId) continue

    const link = it.kind === 'lead' ? `/leads/${it.id}` : `/people/${it.id}`

    // Cada tier tem uma frase própria (legível e única) usada também para
    // deduplicar: não repetimos o mesmo tier dentro da sua janela de dias.
    const suffix = tier === 2
      ? 'Prioridade: já passou bastante tempo, reativa este contacto.'
      : 'Está na hora de um follow-up.'
    const windowDays = tier === 2 ? p.second : p.first
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
    if (recent) continue

    const label = it.kind === 'lead' ? 'Lead' : 'Contacto'
    await createNotification({
      userId,
      agencyId: it.agency_id,
      type: 'task_due',
      title: `${label} a precisar de contacto: ${it.name}`,
      body: `Já não há contacto com ${it.name} há ${daysSince} dias. ${suffix}`,
      link,
    }, supabase)
    processed++
  }

  return NextResponse.json({ processed })
}
