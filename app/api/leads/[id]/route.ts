import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('leads')
    .select('*, users(name, avatar_initials)')
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

  // Buscar estado anterior para detectar mudança de etapa
  const { data: before } = await supabase
    .from('leads')
    .select('stage, name, assigned_to, agency_id')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('leads')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notificar se a etapa mudou
  if (before && body.stage && body.stage !== before.stage && before.assigned_to && before.agency_id) {
    await createNotification({
      userId: before.assigned_to,
      agencyId: before.agency_id,
      type: 'lead_stage_changed',
      title: `Lead ${before.name} movida para ${body.stage}`,
      body: `A lead ${before.name} foi movida de "${before.stage}" para "${body.stage}".`,
      link: `/leads/${id}`,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
