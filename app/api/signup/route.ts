import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  let name: string, email: string, password: string, agencyName: string
  try {
    const body = await request.json()
    name = body.name
    email = body.email
    password = body.password
    agencyName = body.agencyName
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }

  if (!name?.trim() || !agencyName?.trim()) {
    return NextResponse.json({ error: 'Nome e nome da agência são obrigatórios.' }, { status: 400 })
  }
  if (name.trim().length > 200 || agencyName.trim().length > 200) {
    return NextResponse.json({ error: 'Nome e nome da agência devem ter no máximo 200 caracteres.' }, { status: 400 })
  }
  if (!email?.trim() || !EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
  }
  if (email.trim().length > 254) {
    return NextResponse.json({ error: 'Email deve ter no máximo 254 caracteres.' }, { status: 400 })
  }
  if (!password || password.trim().length < 8) {
    return NextResponse.json({ error: 'A password deve ter pelo menos 8 caracteres.' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email: email.trim(),
    password: password.trim(),
    email_confirm: true,
  })

  if (authError) {
    const status = authError.message.toLowerCase().includes('already') ? 409 : 500
    const message = status === 409 ? 'Este email já está registado.' : authError.message
    return NextResponse.json({ error: message }, { status })
  }

  const { data: agency, error: agencyError } = await service
    .from('agencies')
    .insert({
      name: agencyName.trim(),
      email: email.trim(),
    })
    .select('id')
    .single()

  if (agencyError) {
    const { error: rollbackError } = await service.auth.admin.deleteUser(authUser.user.id)
    if (rollbackError) {
      console.error(`Rollback failed: could not delete orphaned auth user ${authUser.user.id} after agency creation failure`, rollbackError)
    }
    const status = agencyError.code === '23505' ? 409 : 500
    const message = status === 409 ? 'Este email já está registado.' : agencyError.message
    return NextResponse.json({ error: message }, { status })
  }

  const initials = name.trim().split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  const { error: userError } = await service
    .from('users')
    .insert({
      id: authUser.user.id,
      agency_id: agency.id,
      name: name.trim(),
      email: email.trim(),
      role: 'admin',
      avatar_initials: initials || 'XX',
    })

  if (userError) {
    const { error: agencyRollbackError } = await service.from('agencies').delete().eq('id', agency.id)
    if (agencyRollbackError) {
      console.error(`Rollback failed: could not delete orphaned agency ${agency.id} after user creation failure`, agencyRollbackError)
    }
    const { error: userRollbackError } = await service.auth.admin.deleteUser(authUser.user.id)
    if (userRollbackError) {
      console.error(`Rollback failed: could not delete orphaned auth user ${authUser.user.id} after user creation failure`, userRollbackError)
    }
    return NextResponse.json({ error: userError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
