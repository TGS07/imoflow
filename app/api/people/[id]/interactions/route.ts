// app/api/people/[id]/interactions/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('contact_interactions')
    .select('*, users(name, avatar_initials)')
    .eq('person_id', id)
    .order('created_at', { ascending: false })

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

  const body = await request.json() as { type: string; note?: string }
  const { data, error } = await supabase
    .from('contact_interactions')
    .insert({ agency_id: profile.agency_id, person_id: id, user_id: user.id, type: body.type, note: body.note || null })
    .select('*, users(name, avatar_initials)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // denormalizar última interação no contacto
  await supabase.from('people').update({ last_interaction_at: data.created_at }).eq('id', id)

  return NextResponse.json(data, { status: 201 })
}
