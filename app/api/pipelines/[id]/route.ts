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

  // Recusar se a pipeline tiver leads — o delete em cascata das etapas
  // falharia na FK de leads.stage_id com um erro críptico do Postgres.
  const { count: leadCount } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('pipeline_id', id)
  if ((leadCount ?? 0) > 0) {
    return NextResponse.json({ error: `Esta pipeline tem ${leadCount} contacto(s) — move-os ou remove-os primeiro.` }, { status: 400 })
  }

  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', id)
    .eq('agency_id', profile.agency_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
