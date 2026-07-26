import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveContactPropertyCandidates } from '@/lib/pipeline/resolve-contact-property'

// Adicionar/remover um contacto de uma pipeline específica.
//
// POST  → cria uma lead na 1ª etapa de uma pipeline, ligada a este contacto
//         (person_id). Aceita pipeline_id no body; sem ele, usa a 1ª pipeline
//         da agência (retrocompatível). O trigger `leads_ensure_contact` não
//         cria contacto duplicado porque person_id já vem preenchido.
// DELETE → remove leads ativas (não fechadas/perdidas) ligadas a este contacto.
//          Aceita ?lead_id= ou ?pipeline_id=; sem filtros, remove de todas.
//          O contacto e o histórico ficam intactos.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: person } = await supabase
    .from('people')
    .select('id, name, email, phone, agency_id, assigned_to, details')
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .single()
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  let pipelineId: string | null = typeof body.pipeline_id === 'string' ? body.pipeline_id : null

  // Sem pipeline_id → 1ª pipeline da agência (retrocompatível com chamadas antigas)
  if (!pipelineId) {
    const { data: firstPipeline } = await supabase
      .from('pipelines')
      .select('id')
      .eq('agency_id', profile.agency_id)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle()
    pipelineId = firstPipeline?.id ?? null
  }
  if (!pipelineId) return NextResponse.json({ error: 'Agência sem pipelines' }, { status: 400 })

  // Já existe uma lead ativa deste contacto NESTA pipeline?
  const { data: activeLeads } = await supabase
    .from('leads')
    .select('id, pipeline_stages!inner(is_won, is_lost)')
    .eq('person_id', id)
    .eq('pipeline_id', pipelineId)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)
    .limit(1)
  if (activeLeads && activeLeads.length > 0) {
    return NextResponse.json({ error: 'Contacto já está nesta pipeline', lead_id: activeLeads[0].id }, { status: 409 })
  }

  // Sem `property_id` no body → resolve automaticamente quando só há 1
  // imóvel candidato; com 2+, o cliente já perguntou ao consultor e manda
  // o `property_id` escolhido (ou null, se escolheu "sem imóvel").
  const hasPropertyOverride = 'property_id' in body
  let propertyId: string | null = hasPropertyOverride && typeof body.property_id === 'string' ? body.property_id : null
  let propertyZone: string | null = null
  let propertyTypology: string | null = null
  let propertyBudget: number | null = null

  if (!hasPropertyOverride) {
    const candidates = await resolveContactPropertyCandidates(supabase, profile.agency_id, id)
    if (candidates.length === 1) {
      propertyId = candidates[0].id
      propertyZone = candidates[0].zone
      propertyTypology = candidates[0].typology
      propertyBudget = candidates[0].price
    }
  } else if (propertyId) {
    const { data: property } = await supabase
      .from('properties')
      .select('zone, typology, price')
      .eq('id', propertyId)
      .eq('agency_id', profile.agency_id)
      .maybeSingle()
    if (property) {
      propertyZone = property.zone
      propertyTypology = property.typology
      propertyBudget = property.price
    } else {
      propertyId = null
    }
  }

  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!firstStage) return NextResponse.json({ error: 'Pipeline sem etapas' }, { status: 400 })

  const details = (person.details ?? {}) as Record<string, unknown>
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      agency_id: profile.agency_id,
      pipeline_id: pipelineId,
      name: person.name,
      email: person.email,
      phone: person.phone,
      stage_id: firstStage.id,
      person_id: person.id,
      property_id: propertyId,
      assigned_to: person.assigned_to ?? user.id,
      zone: propertyZone ?? ((details.search_zone ?? details.selling_zone ?? null) as string | null),
      typology: propertyTypology ?? ((details.typology ?? null) as string | null),
      budget: propertyBudget,
      source: 'outro',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead_id: lead.id }, { status: 201 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  const pipelineId = searchParams.get('pipeline_id')

  let query = supabase
    .from('leads')
    .select('id, pipeline_stages!inner(is_won, is_lost)')
    .eq('person_id', id)
    .eq('agency_id', profile.agency_id)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)
  if (leadId) query = query.eq('id', leadId)
  else if (pipelineId) query = query.eq('pipeline_id', pipelineId)
  // sem filtro → remove de todas (comportamento antigo, retrocompatível)

  const { data: activeLeads } = await query
  const ids = (activeLeads ?? []).map(l => l.id)
  if (ids.length > 0) {
    const { error } = await supabase.from('leads').delete().in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ removed: ids.length })
}
