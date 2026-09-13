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
  if (!email?.trim() || !EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
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
    await service.auth.admin.deleteUser(authUser.user.id)
    const status = agencyError.message.toLowerCase().includes('duplicate') ? 409 : 500
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
    await service.from('agencies').delete().eq('id', agency.id)
    await service.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: userError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
