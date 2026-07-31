import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (body.theme !== 'light' && body.theme !== 'dark') {
    return NextResponse.json({ error: 'Tema inválido.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('users')
    .update({ theme: body.theme })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ theme: body.theme })
}
