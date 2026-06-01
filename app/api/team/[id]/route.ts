import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  if (id === user.id) {
    return NextResponse.json({ error: 'Não podes alterar o teu próprio role' }, { status: 400 })
  }

  let role: string
  try {
    const body = await request.json()
    role = body.role
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (role !== 'admin' && role !== 'agent') {
    return NextResponse.json({ error: 'role deve ser admin ou agent' }, { status: 400 })
  }

  const { data: target } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .single()

  if (!target) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', id)
    .select('id, name, email, role, avatar_initials, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  if (id === user.id) {
    return NextResponse.json({ error: 'Não podes remover-te a ti próprio' }, { status: 400 })
  }

  const { data: target } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .single()

  if (!target) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const reassignTo: string | null = body.reassign_to ?? null

  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', id)

  if ((count ?? 0) > 0 && !reassignTo) {
    return NextResponse.json({ error: 'Este membro tem leads atribuídos. Indica um membro para reatribuir.' }, { status: 400 })
  }

  if (reassignTo && (count ?? 0) > 0) {
    const { error: reassignError } = await supabase
      .from('leads')
      .update({ assigned_to: reassignTo })
      .eq('assigned_to', id)
    if (reassignError) return NextResponse.json({ error: reassignError.message }, { status: 500 })
  }

  const service = createServiceClient()
  const { error: deleteError } = await service.auth.admin.deleteUser(id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return new Response(null, { status: 204 })
}
