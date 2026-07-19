import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Adiciona vários contactos a esta pipeline de uma vez: cria um lead por
// contacto na 1ª etapa da pipeline, ligado ao contacto (person_id). Ignora
// contactos que já tenham uma lead ativa (etapa não won/lost) nesta pipeline.
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
  const personIds: string[] = Array.isArray(body.person_ids) ? body.person_ids : []
  if (personIds.length === 0) return NextResponse.json({ added: 0 })

  // Pipeline da agência + 1ª etapa
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

  // Quem já tem lead ativa nesta pipeline (para não duplicar)
  const { data: existing } = await supabase
    .from('leads')
    .select('person_id, pipeline_stages!inner(is_won, is_lost)')
    .eq('pipeline_id', pipelineId)
    .eq('agency_id', profile.agency_id)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)
    .in('person_id', personIds)
  const alreadyIn = new Set((existing ?? []).map(l => l.person_id))

  const toAdd = personIds.filter(pid => !alreadyIn.has(pid))
  if (toAdd.length === 0) return NextResponse.json({ added: 0 })

  // Dados dos contactos a adicionar
  const { data: people } = await supabase
    .from('people')
    .select('id, name, email, phone, assigned_to, details')
    .eq('agency_id', profile.agency_id)
    .in('id', toAdd)

  const rows = (people ?? []).map(p => {
    // Copiar zona/tipologia do perfil, como na adição individual
    // (/api/people/[id]/pipeline) — os cards da pipeline dependem disto.
    const details = (p.details ?? {}) as Record<string, unknown>
    return {
      agency_id: profile.agency_id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      stage_id: firstStage.id,
      pipeline_id: pipelineId,
      person_id: p.id,
      assigned_to: p.assigned_to ?? user.id,
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
