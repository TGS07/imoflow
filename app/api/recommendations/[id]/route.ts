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

  const body = await request.json()
  const { action, drafted_message } = body as {
    action: 'sent' | 'ignored' | 'edited'
    drafted_message?: string
  }

  const service = createServiceClient()

  if (action === 'sent') {
    await service
      .from('idealista_matches')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
  } else if (action === 'ignored') {
    await service
      .from('idealista_matches')
      .update({ status: 'ignored' })
      .eq('id', id)
      .eq('user_id', user.id)
  } else if (action === 'edited' && drafted_message) {
    await service
      .from('idealista_matches')
      .update({ drafted_message, status: 'edited' })
      .eq('id', id)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true })
}
