import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveContactPropertyCandidates } from '@/lib/pipeline/resolve-contact-property'

// Imóveis já associados a esta pessoa (vendedora, compradora candidata ou
// consultora) — usado para sugerir o imóvel certo ao trocar/escolher o
// imóvel de um card sem obrigar a pesquisar do zero.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const candidates = await resolveContactPropertyCandidates(supabase, profile.agency_id, id)
  return NextResponse.json(candidates)
}
