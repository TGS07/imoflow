import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const CARD_FIELDS = ['name', 'zone', 'property', 'typology', 'value'] as const
function parseCardField(v: unknown): string | undefined {
  return typeof v === 'string' && (CARD_FIELDS as readonly string[]).includes(v) ? v : undefined
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('pipelines')
    .select('*')
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Cria uma pipeline VAZIA (sem etapas — a equipa cria depois nas Definições).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const name = (body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const { data: last } = await supabase
    .from('pipelines')
    .select('position')
    .eq('agency_id', profile.agency_id)
    .order('position', { ascending: false })
    .limit(1)
    .single()
  const position = (last?.position ?? -1) + 1

  const cardPrimary = parseCardField(body.card_primary_field)
  const cardSecondary = parseCardField(body.card_secondary_field)
  if (cardPrimary && cardSecondary && cardPrimary === cardSecondary) {
    return NextResponse.json({ error: 'Info principal e secundária não podem ser iguais' }, { status: 400 })
  }
  const insert: Record<string, unknown> = { agency_id: profile.agency_id, name, position }
  if (cardPrimary) insert.card_primary_field = cardPrimary
  if (cardSecondary) insert.card_secondary_field = cardSecondary

  const { data, error } = await supabase
    .from('pipelines')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
