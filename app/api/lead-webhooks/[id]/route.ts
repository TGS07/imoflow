import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateWebhookToken } from '@/lib/inbound/token'

async function adminProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('users').select('agency_id, role').eq('id', user.id).single()
  if (!profile) return { supabase, error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }
  if (profile.role !== 'admin') return { supabase, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { supabase, profile }
}

// Editar destino/nome/estado, ou { regenerate_token: true } para trocar a chave
// (a antiga deixa de funcionar de imediato).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, profile, error } = await adminProfile()
  if (error) return error
  const body = await request.json().catch(() => ({}))

  const update: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim().slice(0, 100)
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active
  for (const k of ['pipeline_id', 'stage_id', 'assigned_to'] as const) {
    if (k in body) update[k] = typeof body[k] === 'string' && body[k] ? body[k] : null
  }
  if (body.regenerate_token === true) update.token = generateWebhookToken()
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nada a atualizar' }, { status: 400 })

  const { data, error: dbError } = await supabase
    .from('lead_webhooks')
    .update(update)
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .select('*, pipelines(name), pipeline_stages(name), users(name)')
    .single()
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, profile, error } = await adminProfile()
  if (error) return error
  const { error: dbError } = await supabase.from('lead_webhooks').delete().eq('id', id).eq('agency_id', profile.agency_id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
