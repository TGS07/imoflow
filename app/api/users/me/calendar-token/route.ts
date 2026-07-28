import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET devolve o token atual; POST regenera (invalida o link anterior).
// Ambos filtram sempre por id = user.id — nunca expor o token de outro
// utilizador, mesmo que a RLS de `users` permita, em teoria, ler colegas de
// agência (ver "Factos do código" no plano desta funcionalidade).

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .select('calendar_token')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ calendar_token: data.calendar_token })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .update({ calendar_token: randomUUID() })
    .eq('id', user.id)
    .select('calendar_token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ calendar_token: data.calendar_token })
}
