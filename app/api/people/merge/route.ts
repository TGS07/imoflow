import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const primaryId = typeof body.primary_id === 'string' ? body.primary_id : null
  const duplicateId = typeof body.duplicate_id === 'string' ? body.duplicate_id : null
  if (!primaryId || !duplicateId || primaryId === duplicateId) {
    return NextResponse.json({ error: 'primary_id e duplicate_id são obrigatórios e têm de ser diferentes' }, { status: 400 })
  }

  const { data: both } = await supabase
    .from('people')
    .select('id')
    .eq('agency_id', profile.agency_id)
    .in('id', [primaryId, duplicateId])
  if (!both || both.length !== 2) {
    return NextResponse.json({ error: 'Contactos não encontrados nesta agência' }, { status: 404 })
  }

  const { error } = await supabase.rpc('merge_people', { p_primary_id: primaryId, p_duplicate_id: duplicateId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
