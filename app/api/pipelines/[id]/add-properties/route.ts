import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Item = { property_id: string; person_id: string | null }

// Adiciona vários imóveis a esta pipeline de uma vez: cria um lead por
// par (imóvel, pessoa) na 1ª etapa da pipeline. Ao contrário do antigo
// endpoint de contactos, a mesma pessoa pode aparecer várias vezes desde
// que ligada a imóveis diferentes — o duplicado é bloqueado pela
// combinação (person_id, property_id), não só pela pessoa.
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
  const items: Item[] = Array.isArray(body.items)
    ? body.items.filter((i: unknown): i is Item =>
        !!i && typeof i === 'object' && typeof (i as Item).property_id === 'string')
    : []
  if (items.length === 0) return NextResponse.json({ added: 0 })

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

  // Pares (person_id, property_id) já ativos nesta pipeline, para não duplicar
  const propertyIds = [...new Set(items.map(i => i.property_id))]
  const { data: existing } = await supabase
    .from('leads')
    .select('person_id, property_id, pipeline_stages!inner(is_won, is_lost)')
    .eq('pipeline_id', pipelineId)
    .eq('agency_id', profile.agency_id)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)
    .in('property_id', propertyIds)
  const existingKeys = new Set((existing ?? []).map(l => `${l.person_id ?? ''}:${l.property_id}`))

  const toAdd = items.filter(i => !existingKeys.has(`${i.person_id ?? ''}:${i.property_id}`))
  if (toAdd.length === 0) return NextResponse.json({ added: 0 })

  const [{ data: properties }, { data: people }] = await Promise.all([
    supabase.from('properties').select('id, reference, title, zone, typology, price')
      .eq('agency_id', profile.agency_id)
      .in('id', toAdd.map(i => i.property_id)),
    supabase.from('people').select('id, name, email, phone')
      .eq('agency_id', profile.agency_id)
      .in('id', toAdd.filter(i => i.person_id).map(i => i.person_id as string)),
  ])
  const propertyById = new Map((properties ?? []).map(p => [p.id, p]))
  const personById = new Map((people ?? []).map(p => [p.id, p]))

  const rows = toAdd.map(item => {
    const property = propertyById.get(item.property_id)
    const person = item.person_id ? personById.get(item.person_id) : null
    if (!property) return null
    return {
      agency_id: profile.agency_id,
      name: person?.name ?? (property.reference ? `${property.reference} — ${property.title}` : property.title),
      email: person?.email ?? null,
      phone: person?.phone ?? null,
      stage_id: firstStage.id,
      pipeline_id: pipelineId,
      person_id: item.person_id,
      property_id: item.property_id,
      assigned_to: user.id,
      zone: property.zone,
      typology: property.typology,
      budget: property.price,
      source: 'outro',
    }
  }).filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) return NextResponse.json({ added: 0 })

  const { error } = await supabase.from('leads').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ added: rows.length })
}
