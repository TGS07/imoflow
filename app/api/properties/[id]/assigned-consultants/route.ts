// app/api/properties/[id]/assigned-consultants/route.ts
// Associação explícita imóvel↔consultor (partilha), distinta da sugestão
// automática por zona em /api/properties/[id]/consultants.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('agency_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json() as { person_id?: string }
  if (!body.person_id) return NextResponse.json({ error: 'person_id em falta' }, { status: 400 })

  const { data, error } = await supabase
    .from('property_consultants')
    .insert({ agency_id: profile.agency_id, property_id: id, person_id: body.person_id })
    .select('id, person_id, people(id, name, phone, email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const personId = searchParams.get('person_id')
  if (!personId) return NextResponse.json({ error: 'person_id em falta' }, { status: 400 })

  const { error } = await supabase
    .from('property_consultants')
    .delete()
    .eq('property_id', id)
    .eq('person_id', personId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
