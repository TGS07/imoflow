import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('web_forms')
    .select('*')
    .eq('id', id)
    .single()

  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const VALID_FIELDS = new Set(['name', 'email', 'phone', 'message', 'zone', 'typology', 'budget'])

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (typeof body.name === 'string') updates.name = body.name.trim()
  if ('description' in body) updates.description = body.description?.trim() || null
  if (body.fields !== undefined) {
    if (!Array.isArray(body.fields) || !body.fields.every((f: unknown) => typeof f === 'string' && VALID_FIELDS.has(f))) {
      return NextResponse.json({ error: 'Invalid fields value' }, { status: 400 })
    }
    updates.fields = body.fields
  }
  if ('stage_id' in body) updates.stage_id = body.stage_id
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('web_forms')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('web_forms')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
