import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Devolve o sha do último deploy registado, para a Action calcular os commits novos.
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await createServiceClient()
    .from('release_notes')
    .select('sha')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sha: data?.sha ?? null })
}
