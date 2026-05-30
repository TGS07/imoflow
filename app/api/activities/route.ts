import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const lead_id = searchParams.get('lead_id')
  const person_id = searchParams.get('person_id')
  const type = searchParams.get('type')
  const assigned_to = searchParams.get('assigned_to')
  const completed = searchParams.get('completed')
  const date_from = searchParams.get('date_from')
  const date_to = searchParams.get('date_to')

  let query = supabase
    .from('activities')
    .select('*, users:assigned_to(name, avatar_initials), leads(id, name), people(id, name)')
    .order('due_date', { ascending: true, nullsFirst: false })

  if (lead_id) query = query.eq('lead_id', lead_id)
  if (person_id) query = query.eq('person_id', person_id)
  if (type) query = query.eq('type', type)
  if (assigned_to) query = query.eq('assigned_to', assigned_to)
  if (completed) query = query.eq('completed', completed === 'true')
  if (date_from) query = query.gte('due_date', date_from)
  if (date_to) query = query.lte('due_date', date_to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

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

  const body = await request.json()
  const { data, error } = await supabase
    .from('activities')
    .insert({ ...body, agency_id: profile.agency_id, assigned_to: body.assigned_to ?? user.id })
    .select('*, users:assigned_to(name, avatar_initials), leads(id, name), people(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
