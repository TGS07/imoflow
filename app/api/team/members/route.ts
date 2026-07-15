import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Lista leve dos membros da agência, para os seletores de "responsável" em
// contactos e leads. Ao contrário de /api/team (só admin), este está
// disponível para qualquer utilizador autenticado da agência.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('users')
    .select('id, name, avatar_initials')
    .eq('agency_id', profile.agency_id)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ members: data ?? [], current_user_id: user.id })
}
