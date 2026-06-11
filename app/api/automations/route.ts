import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('agency_id', profile.agency_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

const VALID_TRIGGERS = ['lead_created', 'stage_changed', 'activity_completed', 'lead_inactive', 'whatsapp_message_received']
const VALID_ACTIONS = ['create_activity', 'send_notification', 'move_stage', 'send_email', 'send_whatsapp']

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

  let body: {
    name?: string
    description?: string | null
    trigger_type?: string
    trigger_config?: Record<string, unknown>
    action_type?: string
    action_config?: Record<string, unknown>
    is_active?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 })
  }
  if (!body.trigger_type || !VALID_TRIGGERS.includes(body.trigger_type)) {
    return NextResponse.json({ error: 'trigger_type inválido' }, { status: 400 })
  }
  if (!body.action_type || !VALID_ACTIONS.includes(body.action_type)) {
    return NextResponse.json({ error: 'action_type inválido' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('automation_rules')
    .insert({
      agency_id: profile.agency_id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      trigger_type: body.trigger_type,
      trigger_config: body.trigger_config ?? {},
      action_type: body.action_type,
      action_config: body.action_config ?? {},
      is_active: body.is_active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
