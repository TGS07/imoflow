import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveContactPropertyCandidates } from '@/lib/pipeline/resolve-contact-property'

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

  // Escolhas explícitas do cliente para contactos com 2+ imóveis candidatos
  // (perguntadas no ContactPickerModal antes de submeter). Valor `null`
  // significa "sem imóvel", escolhido deliberadamente.
  const propertyChoices: Record<string, string | null> = (body.property_choices && typeof body.property_choices === 'object')
    ? body.property_choices
    : {}

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

  // Imóveis escolhidos explicitamente (não nulos) — preciso de zone/typology/price
  // para copiar para a lead, tal como o add-properties já faz.
  const explicitIds = [...new Set(Object.values(propertyChoices).filter((v): v is string => typeof v === 'string'))]
  const { data: explicitProperties } = explicitIds.length > 0
    ? await supabase.from('properties').select('id, zone, typology, price').eq('agency_id', profile.agency_id).in('id', explicitIds)
    : { data: [] as { id: string; zone: string | null; typology: string | null; price: number | null }[] }
  const explicitPropertyById = new Map((explicitProperties ?? []).map(p => [p.id, p]))

  const rows = await Promise.all((people ?? []).map(async person => {
    const details = (person.details ?? {}) as Record<string, unknown>
    const hasChoice = person.id in propertyChoices

    let propertyId: string | null = null
    let propertyZone: string | null = null
    let propertyTypology: string | null = null
    let propertyBudget: number | null = null

    if (hasChoice) {
      propertyId = propertyChoices[person.id]
      if (propertyId) {
        const property = explicitPropertyById.get(propertyId)
        if (property) {
          propertyZone = property.zone
          propertyTypology = property.typology
          propertyBudget = property.price
        }
      }
    } else {
      const candidates = await resolveContactPropertyCandidates(supabase, profile.agency_id, person.id)
      if (candidates.length === 1) {
        propertyId = candidates[0].id
        propertyZone = candidates[0].zone
        propertyTypology = candidates[0].typology
        propertyBudget = candidates[0].price
      }
    }

    return {
      agency_id: profile.agency_id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      stage_id: firstStage.id,
      pipeline_id: pipelineId,
      person_id: person.id,
      property_id: propertyId,
      assigned_to: user.id,
      zone: propertyZone ?? ((details.search_zone ?? details.selling_zone ?? null) as string | null),
      typology: propertyTypology ?? ((details.typology ?? null) as string | null),
      budget: propertyBudget,
      source: 'outro',
    }
  }))

  if (rows.length === 0) return NextResponse.json({ added: 0 })

  const { error } = await supabase.from('leads').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ added: rows.length })
}
