import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const CARD_FIELDS = ['name', 'zone', 'property', 'typology', 'value'] as const
function parseCardField(v: unknown): string | undefined {
  return typeof v === 'string' && (CARD_FIELDS as readonly string[]).includes(v) ? v : undefined
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const update: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim()
  if (typeof body.position === 'number') update.position = body.position
  const cardPrimary = parseCardField(body.card_primary_field)
  const cardSecondary = parseCardField(body.card_secondary_field)
  if (cardPrimary && cardSecondary && cardPrimary === cardSecondary) {
    return NextResponse.json({ error: 'Info principal e secundária não podem ser iguais' }, { status: 400 })
  }
  if (cardPrimary) update.card_primary_field = cardPrimary
  if (cardSecondary) update.card_secondary_field = cardSecondary
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nada a atualizar' }, { status: 400 })

  const { data, error } = await supabase
    .from('pipelines')
    .update(update)
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Não deixar apagar a última pipeline da agência
  const { count } = await supabase
    .from('pipelines')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', profile.agency_id)
  if ((count ?? 0) <= 1) return NextResponse.json({ error: 'Tem de existir pelo menos uma pipeline' }, { status: 400 })

  // As leads desta pipeline são apagadas antes da pipeline em si — o FK de
  // leads.stage_id impede o cascade normal de pipeline_stages. Isto só apaga
  // a ligação à pipeline: people/organizations/properties nunca são tocados
  // (todos os FKs lead_id no schema são ON DELETE CASCADE — activities,
  // tasks, contacts, automation_logs, etc. — por isso isto é seguro).
  const { error: leadsError } = await supabase
    .from('leads')
    .delete()
    .eq('pipeline_id', id)
    .eq('agency_id', profile.agency_id)
  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })

  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', id)
    .eq('agency_id', profile.agency_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
