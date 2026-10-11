import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const typesParam = searchParams.get('types') // csv: "comprador,vendedor"

  let query = supabase
    .from('people')
    .select('*, leads(id, name, stage_id, deal_value, pipeline_stages(name, color))')
    .order('last_interaction_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (typesParam) {
    const arr = typesParam.split(',').filter(Boolean)
    if (arr.length) query = query.overlaps('types', arr)
  }

  if (search) {
    const term = search.replace(/[%_\\]/g, '\\$&')
    // Inclui morada e as zonas do perfil (jsonb details) — permite pesquisar
    // por zona ("Parede", "Cascais") além de nome/email/telefone.
    query = query.or(
      `name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,address.ilike.%${term}%,` +
      `details->>search_zone.ilike.%${term}%,details->>selling_zone.ilike.%${term}%,details->>working_zone.ilike.%${term}%`
    )
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json()
  const insert = {
    agency_id: profile.agency_id,
    name: body.name,
    email: body.email || null,
    phone: body.phone || null,
    address: body.address || null,
    notes: body.notes || null,
    types: Array.isArray(body.types) ? body.types : [],
    financial_capacity: body.financial_capacity || null,
    source: body.source || 'manual',
    details: body.details && typeof body.details === 'object' ? body.details : {},
    // Responsável obrigatório na criação; sem ele, ninguém recebe os
    // lembretes de follow-up. O frontend pré-seleciona o utilizador atual.
    assigned_to: body.assigned_to || user.id,
    is_regular: body.is_regular === true,
    birthday: body.birthday || null,
  }

  const { data, error } = await supabase.from('people').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
