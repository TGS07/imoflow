import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

  const body = await request.json()
  const { ids, stage_id, remove } = body as { ids: string[]; stage_id?: string; remove?: boolean }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids is required' }, { status: 400 })
  }

  if (remove) {
    const { error } = await supabase
      .from('leads')
      .delete()
      .in('id', ids)
      .eq('agency_id', profile.agency_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, removed: ids.length })
  }

  if (stage_id) {
    const { error } = await supabase
      .from('leads')
      .update({ stage_id })
      .in('id', ids)
      .eq('agency_id', profile.agency_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, moved: ids.length })
  }

  return NextResponse.json({ error: 'stage_id or remove required' }, { status: 400 })
}
