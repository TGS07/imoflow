import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Template = 'vendedores' | 'compradores' | 'leads_simples' | 'custom'

type StageInsert = {
  name: string
  color: string
  position: number
  probability: number
  is_won: boolean
  is_lost: boolean
}

const VENDEDORES_STAGES: StageInsert[] = [
  { name: 'Contacto', color: '#3B82F6', position: 0, probability: 10, is_won: false, is_lost: false },
  { name: 'Angariação', color: '#F59E0B', position: 1, probability: 30, is_won: false, is_lost: false },
  { name: 'Avaliação', color: '#8B5CF6', position: 2, probability: 45, is_won: false, is_lost: false },
  { name: 'Em promoção', color: '#14B8A6', position: 3, probability: 60, is_won: false, is_lost: false },
  { name: 'Proposta', color: '#F97316', position: 4, probability: 80, is_won: false, is_lost: false },
  { name: 'Vendido', color: '#10B981', position: 5, probability: 100, is_won: true, is_lost: false },
  { name: 'Perdido', color: '#EF4444', position: 6, probability: 0, is_won: false, is_lost: true },
]

const COMPRADORES_STAGES: StageInsert[] = [
  { name: 'Contacto', color: '#3B82F6', position: 0, probability: 10, is_won: false, is_lost: false },
  { name: 'Qualificação', color: '#F59E0B', position: 1, probability: 30, is_won: false, is_lost: false },
  { name: 'Visitas', color: '#8B5CF6', position: 2, probability: 50, is_won: false, is_lost: false },
  { name: 'Proposta', color: '#F97316', position: 3, probability: 70, is_won: false, is_lost: false },
  { name: 'Negociação', color: '#EC4899', position: 4, probability: 85, is_won: false, is_lost: false },
  { name: 'Fechado', color: '#10B981', position: 5, probability: 100, is_won: true, is_lost: false },
  { name: 'Perdido', color: '#EF4444', position: 6, probability: 0, is_won: false, is_lost: true },
]

const LEADS_SIMPLES_STAGES: StageInsert[] = [
  { name: 'Contacto', color: '#3B82F6', position: 0, probability: 15, is_won: false, is_lost: false },
  { name: 'Qualificação', color: '#F59E0B', position: 1, probability: 40, is_won: false, is_lost: false },
  { name: 'Proposta', color: '#F97316', position: 2, probability: 70, is_won: false, is_lost: false },
  { name: 'Fechado', color: '#10B981', position: 3, probability: 100, is_won: true, is_lost: false },
  { name: 'Perdido', color: '#EF4444', position: 4, probability: 0, is_won: false, is_lost: true },
]

async function mergeOnboardingState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agencyId: string,
  patch: Record<string, unknown>
) {
  const { data: current } = await supabase
    .from('agencies')
    .select('onboarding_state')
    .eq('id', agencyId)
    .single()
  await supabase
    .from('agencies')
    .update({ onboarding_state: { ...(current?.onboarding_state ?? {}), ...patch } })
    .eq('id', agencyId)
}

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

  let body: { template?: Template; name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const template = body.template
  const validTemplates: Template[] = ['vendedores', 'compradores', 'leads_simples', 'custom']
  if (!template || !validTemplates.includes(template)) {
    return NextResponse.json({ error: 'template inválido' }, { status: 400 })
  }

  let pipelineName: string
  let stages: StageInsert[] = []

  if (template === 'custom') {
    const name = (body.name ?? '').trim()
    if (!name || name.length > 100) {
      return NextResponse.json({ error: 'Nome obrigatório (máx. 100 caracteres)' }, { status: 400 })
    }
    pipelineName = name
  } else if (template === 'vendedores') {
    pipelineName = 'Vendedores'
    stages = VENDEDORES_STAGES
  } else if (template === 'compradores') {
    pipelineName = 'Compradores'
    stages = COMPRADORES_STAGES
  } else {
    pipelineName = 'Leads'
    stages = LEADS_SIMPLES_STAGES
  }

  const { data: last } = await supabase
    .from('pipelines')
    .select('position')
    .eq('agency_id', profile.agency_id)
    .order('position', { ascending: false })
    .limit(1)
    .single()
  const position = (last?.position ?? -1) + 1

  const { data: pipeline, error: pipelineError } = await supabase
    .from('pipelines')
    .insert({ agency_id: profile.agency_id, name: pipelineName, position })
    .select()
    .single()

  if (pipelineError) return NextResponse.json({ error: pipelineError.message }, { status: 500 })

  let stageIds: string[] = []
  if (stages.length > 0) {
    const { data: insertedStages, error: stagesError } = await supabase
      .from('pipeline_stages')
      .insert(
        stages.map(s => ({
          agency_id: profile.agency_id,
          pipeline_id: pipeline.id,
          name: s.name,
          color: s.color,
          position: s.position,
          probability: s.probability,
          is_won: s.is_won,
          is_lost: s.is_lost,
        }))
      )
      .select('id')

    if (stagesError) return NextResponse.json({ error: stagesError.message }, { status: 500 })
    stageIds = (insertedStages ?? []).map(s => s.id)
  }

  await mergeOnboardingState(supabase, profile.agency_id, { pipeline: true })

  return NextResponse.json({ pipeline_id: pipeline.id, stage_ids: stageIds }, { status: 201 })
}
