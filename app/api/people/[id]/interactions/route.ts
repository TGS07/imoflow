// app/api/people/[id]/interactions/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { InteractionOutcome } from '@/types'
import { OUTCOMES_BY_TYPE, CONTACT_INTERACTION_TYPES, temperatureFromOutcome, daysUntil } from '@/lib/contacts/engagement'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('contact_interactions')
    .select('*, users(name, avatar_initials)')
    .eq('person_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('agency_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json() as { type: string; note?: string; outcome?: string | null }
  const outcome = body.outcome && (OUTCOMES_BY_TYPE[body.type] ?? []).includes(body.outcome as InteractionOutcome)
    ? body.outcome as InteractionOutcome
    : null
  const { data, error } = await supabase
    .from('contact_interactions')
    .insert({ agency_id: profile.agency_id, person_id: id, user_id: user.id, type: body.type, note: body.note || null, outcome })
    .select('*, users(name, avatar_initials)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // denormalizar última interação no contacto; uma chamada atendida aquece o
  // contacto, uma não atendida arrefece-o. Um contacto feito no dia (ou depois)
  // da "próxima chamada" agendada dá-a por cumprida.
  const personUpdate: Record<string, unknown> = { last_interaction_at: data.created_at }
  const temperature = temperatureFromOutcome(body.type, outcome)
  if (temperature) personUpdate.temperature = temperature
  if ((CONTACT_INTERACTION_TYPES as readonly string[]).includes(body.type)) {
    const { data: person } = await supabase.from('people').select('next_call_at').eq('id', id).single()
    if (person?.next_call_at && daysUntil(person.next_call_at) <= 0) personUpdate.next_call_at = null
  }
  await supabase.from('people').update(personUpdate).eq('id', id)

  return NextResponse.json(data, { status: 201 })
}
