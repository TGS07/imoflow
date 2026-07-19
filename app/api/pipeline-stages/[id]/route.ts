import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('pipeline_stages')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('agency_id')
    .eq('id', id)
    .single()

  if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('agency_id', stage.agency_id)
    .neq('id', id)
    .order('position', { ascending: true })
    .limit(1)
    .single()

  if (!firstStage) {
    return NextResponse.json({ error: 'Cannot delete the last stage' }, { status: 400 })
  }

  await supabase
    .from('leads')
    .update({ stage_id: firstStage.id })
    .eq('stage_id', id)

  // Limpar regras de automação ligadas a esta etapa (avisos do editor 🔔 e
  // quaisquer regras manuais que a referenciem) — sem FK possível no jsonb.
  const { error: rulesError } = await supabase
    .from('automation_rules')
    .delete()
    .or(`trigger_config->>to_stage_id.eq.${id},trigger_config->>stage_id.eq.${id}`)
  if (rulesError) return NextResponse.json({ error: rulesError.message }, { status: 500 })

  const { error } = await supabase.from('pipeline_stages').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
