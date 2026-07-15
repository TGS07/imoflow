import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const pipelineId = searchParams.get('pipeline_id')

  let query = supabase
    .from('pipeline_stages')
    .select('*')
    .order('position', { ascending: true })
  if (pipelineId) query = query.eq('pipeline_id', pipelineId)

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
    .select('agency_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const pipelineId = body.pipeline_id
  if (!pipelineId) return NextResponse.json({ error: 'pipeline_id obrigatório' }, { status: 400 })

  // Confirmar que a pipeline pertence à agência
  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('id', pipelineId)
    .eq('agency_id', profile.agency_id)
    .single()
  if (!pipeline) return NextResponse.json({ error: 'Pipeline inválida' }, { status: 400 })

  // Posição é por pipeline
  const { data: maxStage } = await supabase
    .from('pipeline_stages')
    .select('position')
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPosition = (maxStage?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({
      agency_id: profile.agency_id,
      pipeline_id: pipelineId,
      name: body.name,
      color: body.color ?? '#6B7280',
      position: nextPosition,
      probability: body.probability ?? 0,
      is_won: body.is_won ?? false,
      is_lost: body.is_lost ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
