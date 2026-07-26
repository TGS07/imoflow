import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Adiciona vários contactos já existentes a esta pipeline de uma vez: cria
// uma lead por pessoa na 1ª etapa, sem imóvel associado. Bloqueia
// duplicados por combinação (person_id, pipeline_id) com lead ativa —
// mesma regra do POST /api/people/[id]/pipeline (um único contacto de
// cada vez), aplicada aqui em lote.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: pipelineId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const personIds: string[] = Array.isArray(body.person_ids)
    ? body.person_ids.filter((v: unknown): v is string => typeof v === 'string')
    : []
  if (personIds.length === 0) return NextResponse.json({ added: 0 })

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('id', pipelineId)
    .eq('agency_id', profile.agency_id)
    .single()
  if (!pipeline) return NextResponse.json({ error: 'Pipeline inválida' }, { status: 404 })

  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!firstStage) return NextResponse.json({ error: 'A pipeline não tem etapas. Cria uma etapa primeiro.' }, { status: 400 })

  const { data: existing } = await supabase
    .from('leads')
    .select('person_id, pipeline_stages!inner(is_won, is_lost)')
    .eq('pipeline_id', pipelineId)
    .eq('agency_id', profile.agency_id)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)
    .in('person_id', personIds)
  const existingIds = new Set((existing ?? []).map(l => l.person_id))

  const toAdd = personIds.filter(id => !existingIds.has(id))
  if (toAdd.length === 0) return NextResponse.json({ added: 0 })

  const { data: people } = await supabase
    .from('people')
    .select('id, name, email, phone, details')
    .eq('agency_id', profile.agency_id)
    .in('id', toAdd)

  const rows = (people ?? []).map(person => {
    const details = (person.details ?? {}) as Record<string, unknown>
    return {
      agency_id: profile.agency_id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      stage_id: firstStage.id,
      pipeline_id: pipelineId,
      person_id: person.id,
      property_id: null,
      assigned_to: user.id,
      zone: (details.search_zone ?? details.selling_zone ?? null) as string | null,
      typology: (details.typology ?? null) as string | null,
      source: 'outro',
    }
  })

  if (rows.length === 0) return NextResponse.json({ added: 0 })

  const { error } = await supabase.from('leads').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ added: rows.length })
}
