import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stages } = await request.json() as { stages: { id: string; position: number }[] }

  for (const stage of stages) {
    await supabase
      .from('pipeline_stages')
      .update({ position: stage.position })
      .eq('id', stage.id)
  }

  return NextResponse.json({ success: true })
}
