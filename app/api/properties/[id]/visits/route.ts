// app/api/properties/[id]/visits/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('property_visits')
    .select('*, people(id, name)')
    .eq('property_id', id)
    .order('visited_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('users').select('agency_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json() as { person_id?: string; visitor_name?: string; agency_name?: string; visited_at?: string; notes?: string }
  const { data, error } = await supabase.from('property_visits').insert({
    agency_id: profile.agency_id, property_id: id,
    person_id: body.person_id || null, visitor_name: body.visitor_name || null,
    agency_name: body.agency_name || null, visited_at: body.visited_at || new Date().toISOString(),
    notes: body.notes || null,
  }).select('*, people(id, name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
