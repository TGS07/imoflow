import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const zone = searchParams.get('zone')
  const priceMin = searchParams.get('price_min')
  const priceMax = searchParams.get('price_max')

  let query = supabase
    .from('properties')
    .select('*, leads(id)')
    .order('created_at', { ascending: false })

  if (search) {
    const term = search.replace(/[%_\\]/g, '\\$&')
    query = query.or(`title.ilike.%${term}%,reference.ilike.%${term}%,address.ilike.%${term}%`)
  }
  if (type) query = query.eq('type', type)
  if (status) query = query.eq('status', status)
  if (zone) {
    const term = zone.replace(/[%_\\]/g, '\\$&')
    query = query.ilike('zone', `%${term}%`)
  }
  if (priceMin) query = query.gte('price', Number(priceMin))
  if (priceMax) query = query.lte('price', Number(priceMax))

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
    .from('properties')
    .insert({ ...body, agency_id: profile.agency_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
