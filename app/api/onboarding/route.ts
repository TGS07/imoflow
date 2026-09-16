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

  const { data: agency, error } = await supabase
    .from('agencies')
    .select('onboarding_completed, onboarding_state')
    .eq('id', profile.agency_id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [{ count: pipelineCount }, { count: contactCount }, { count: userCount }] = await Promise.all([
    supabase
      .from('pipelines')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', profile.agency_id),
    supabase
      .from('people')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', profile.agency_id),
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', profile.agency_id),
  ])

  return NextResponse.json({
    onboarding_completed: agency.onboarding_completed,
    onboarding_state: agency.onboarding_state,
    has_pipeline: (pipelineCount ?? 0) > 0,
    has_contact: (contactCount ?? 0) > 0,
    has_team_member: (userCount ?? 0) > 1,
  })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  let body: {
    onboarding_state?: Record<string, unknown>
    onboarding_completed?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const hasState = 'onboarding_state' in body
  const hasCompleted = 'onboarding_completed' in body
  if (!hasState && !hasCompleted) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (hasState && (typeof body.onboarding_state !== 'object' || body.onboarding_state === null || Array.isArray(body.onboarding_state))) {
    return NextResponse.json({ error: 'onboarding_state inválido' }, { status: 400 })
  }
  if (hasCompleted && typeof body.onboarding_completed !== 'boolean') {
    return NextResponse.json({ error: 'onboarding_completed inválido' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if (hasState) {
    const { data: current } = await supabase
      .from('agencies')
      .select('onboarding_state')
      .eq('id', profile.agency_id)
      .single()
    updates.onboarding_state = { ...(current?.onboarding_state ?? {}), ...body.onboarding_state }
  }

  if (hasCompleted) {
    updates.onboarding_completed = body.onboarding_completed
  }

  const { data, error } = await supabase
    .from('agencies')
    .update(updates)
    .eq('id', profile.agency_id)
    .select('onboarding_completed, onboarding_state')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
