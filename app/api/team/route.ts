import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: members, error } = await supabase
    .from('users')
    .select('id, name, email, role, avatar_initials, created_at, telegram_chat_id')
    .eq('agency_id', profile.agency_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: leadRows } = await supabase
    .from('leads')
    .select('assigned_to')
    .eq('agency_id', profile.agency_id)
    .not('assigned_to', 'is', null)

  const countMap: Record<string, number> = {}
  for (const row of leadRows ?? []) {
    if (row.assigned_to) countMap[row.assigned_to] = (countMap[row.assigned_to] ?? 0) + 1
  }

  const result = (members ?? []).map(m => ({ ...m, lead_count: countMap[m.id] ?? 0 }))
  return NextResponse.json({ members: result, current_user_id: user.id })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let name: string, email: string, password: string, role: string
  try {
    const body = await request.json()
    name = body.name
    email = body.email
    password = body.password
    role = body.role ?? 'agent'
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'name, email e password são obrigatórios' }, { status: 400 })
  }
  if (password.trim().length < 8) {
    return NextResponse.json({ error: 'password deve ter pelo menos 8 caracteres' }, { status: 400 })
  }
  if (role !== 'admin' && role !== 'agent') {
    return NextResponse.json({ error: 'role deve ser admin ou agent' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email: email.trim(),
    password: password.trim(),
    email_confirm: true,
  })

  if (authError) {
    const status = authError.message.toLowerCase().includes('already') ? 409 : 500
    return NextResponse.json({ error: authError.message }, { status })
  }

  const initials = name.trim().split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const { data: newProfile, error: profileError } = await service
    .from('users')
    .insert({
      id: authUser.user.id,
      agency_id: profile.agency_id,
      name: name.trim(),
      email: email.trim(),
      role,
      avatar_initials: initials,
    })
    .select('id, name, email, role, avatar_initials, created_at')
    .single()

  if (profileError) {
    await service.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json(newProfile, { status: 201 })
}
