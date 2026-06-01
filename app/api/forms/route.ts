import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('web_forms')
    .select('*, pipeline_stages(name)')
    .order('created_at', { ascending: false })

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

  const VALID_FIELDS = new Set(['name', 'email', 'phone', 'message', 'zone', 'typology', 'budget'])

  const body = await request.json()
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  if (body.fields !== undefined) {
    if (!Array.isArray(body.fields) || !body.fields.every((f: unknown) => typeof f === 'string' && VALID_FIELDS.has(f))) {
      return NextResponse.json({ error: 'Invalid fields value' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('web_forms')
    .insert({
      agency_id: profile.agency_id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      fields: body.fields ?? ['name', 'email', 'phone'],
      stage_id: body.stage_id ?? null,
      is_active: typeof body.is_active === 'boolean' ? body.is_active : true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
