import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { triggerAutomations } from '@/lib/automations/engine'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('activities')
    .select('*, users:assigned_to(name, avatar_initials), leads(id, name), people(id, name)')
    .eq('id', id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const wasCompleted = body.completed === true

  // Guardar estado anterior para detectar mudança para completed
  const { data: before } = await supabase
    .from('activities')
    .select('completed, lead_id, assigned_to')
    .eq('id', id)
    .single()

  if (body.completed === true && !body.completed_at) {
    body.completed_at = new Date().toISOString()
  }
  if (body.completed === false) {
    body.completed_at = null
  }

  const { data, error } = await supabase
    .from('activities')
    .update(body)
    .eq('id', id)
    .select('*, users:assigned_to(name, avatar_initials), leads(id, name), people(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Disparar automações quando atividade é marcada como concluída e estava incompleta
  if (wasCompleted && before && !before.completed && before.lead_id) {
    // Buscar agencyId do lead
    const { data: lead } = await supabase
      .from('leads')
      .select('agency_id')
      .eq('id', before.lead_id)
      .single()

    if (lead?.agency_id) {
      triggerAutomations({
        type: 'activity_completed',
        leadId: before.lead_id,
        userId: user.id,
        agencyId: lead.agency_id,
        meta: { activityId: id },
      }).catch(console.error)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
