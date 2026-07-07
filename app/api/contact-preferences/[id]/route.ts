import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

// Preferências de procura (estilo Idealista) associadas a um contacto (person_id),
// em paralelo às já existentes por lead. Mesma tabela `lead_preferences`.
async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('agency_id').eq('id', user.id).single()
  if (!profile) return null
  return { userId: user.id, agencyId: profile.agency_id }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('lead_preferences')
    .select('*')
    .eq('person_id', id)
    .eq('agency_id', profile.agencyId)
    .single()

  return NextResponse.json(data ?? null)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Confirmar que o contacto pertence à agência do utilizador
  const { data: person } = await supabase.from('people').select('id').eq('id', id).eq('agency_id', profile.agencyId).single()
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { zonas, tipologia_min, preco_max, extras, is_active } = body

  const { data, error } = await supabase
    .from('lead_preferences')
    .upsert({ person_id: id, agency_id: profile.agencyId, zonas, tipologia_min, preco_max, extras, is_active }, { onConflict: 'person_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('lead_preferences')
    .delete()
    .eq('person_id', id)
    .eq('agency_id', profile.agencyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
