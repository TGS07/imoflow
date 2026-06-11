import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_TRIGGERS = ['lead_created', 'stage_changed', 'activity_completed', 'lead_inactive', 'whatsapp_message_received']
const VALID_ACTIONS = ['create_activity', 'send_notification', 'move_stage', 'send_email', 'send_whatsapp']

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, agency_id')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    is_active?: boolean
    name?: string
    description?: string | null
    trigger_type?: string
    trigger_config?: Record<string, unknown>
    action_type?: string
    action_config?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if ('is_active' in body) {
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 })
    }
    updates.is_active = body.is_active
  }
  if (typeof body.name === 'string') {
    if (!body.name.trim()) return NextResponse.json({ error: 'name não pode ser vazio' }, { status: 400 })
    updates.name = body.name.trim()
  }
  if ('description' in body) {
    updates.description = body.description?.trim() || null
  }
  if (typeof body.trigger_type === 'string') {
    if (!VALID_TRIGGERS.includes(body.trigger_type)) {
      return NextResponse.json({ error: 'trigger_type inválido' }, { status: 400 })
    }
    updates.trigger_type = body.trigger_type
  }
  if (body.trigger_config && typeof body.trigger_config === 'object') {
    updates.trigger_config = body.trigger_config
  }
  if (typeof body.action_type === 'string') {
    if (!VALID_ACTIONS.includes(body.action_type)) {
      return NextResponse.json({ error: 'action_type inválido' }, { status: 400 })
    }
    updates.action_type = body.action_type
  }
  if (body.action_config && typeof body.action_config === 'object') {
    updates.action_config = body.action_config
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('automation_rules')
    .update(updates)
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .select()
    .single()

  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, agency_id')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: deleted, error } = await supabase
    .from('automation_rules')
    .delete()
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!deleted || deleted.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new Response(null, { status: 204 })
}
