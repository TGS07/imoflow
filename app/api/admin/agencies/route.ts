import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getAdminClient()
  const { data, error } = await admin.from('agencies').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email !== process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let name: string, email: string, password: string
  try {
    const body = await request.json()
    name = body.name
    email = body.email
    password = body.password
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email e password sao obrigatorios' }, { status: 400 })
  }

  const admin = getAdminClient()

  // 1. Criar agencia
  const { data: agency, error: agencyError } = await admin
    .from('agencies')
    .insert({ name, email })
    .select()
    .single()

  if (agencyError) return NextResponse.json({ error: agencyError.message }, { status: 500 })

  // 2. Seed default pipeline stages
  await admin.from('pipeline_stages').insert([
    { agency_id: agency.id, name: 'Lead',        color: '#3B82F6', position: 0, probability: 10,  is_won: false, is_lost: false },
    { agency_id: agency.id, name: 'Visita',      color: '#F59E0B', position: 1, probability: 30,  is_won: false, is_lost: false },
    { agency_id: agency.id, name: 'Proposta',    color: '#8B5CF6', position: 2, probability: 50,  is_won: false, is_lost: false },
    { agency_id: agency.id, name: 'Negociacao',  color: '#F97316', position: 3, probability: 70,  is_won: false, is_lost: false },
    { agency_id: agency.id, name: 'Fechado',     color: '#10B981', position: 4, probability: 100, is_won: true,  is_lost: false },
    { agency_id: agency.id, name: 'Perdido',     color: '#EF4444', position: 5, probability: 0,   is_won: false, is_lost: true  },
  ])

  // 3. Criar utilizador no Auth
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    await admin.from('pipeline_stages').delete().eq('agency_id', agency.id)
    await admin.from('agencies').delete().eq('id', agency.id)
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // 4. Criar perfil do utilizador
  const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
  const { error: profileError } = await admin.from('users').insert({
    id: authUser.user.id,
    agency_id: agency.id,
    name,
    email,
    role: 'admin',
    avatar_initials: initials,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    await admin.from('pipeline_stages').delete().eq('agency_id', agency.id)
    await admin.from('agencies').delete().eq('id', agency.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ agency, user: authUser.user }, { status: 201 })
}
