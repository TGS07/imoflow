import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Adicionar/remover um contacto do pipeline.
//
// POST  → cria uma lead na 1ª etapa do pipeline, ligada a este contacto
//         (person_id). O trigger `leads_ensure_contact` não cria contacto
//         duplicado porque person_id já vem preenchido.
// DELETE → remove a lead ATIVA (não fechada/perdida) ligada a este contacto.
//          O contacto e o histórico ficam intactos.

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: person } = await supabase
    .from('people')
    .select('id, name, email, phone, agency_id, assigned_to, details')
    .eq('id', id)
    .eq('agency_id', profile.agency_id)
    .single()
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Já existe uma lead ativa para este contacto?
  const { data: activeLeads } = await supabase
    .from('leads')
    .select('id, pipeline_stages!inner(is_won, is_lost)')
    .eq('person_id', id)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)
    .limit(1)
  if (activeLeads && activeLeads.length > 0) {
    return NextResponse.json({ error: 'Contacto já está no pipeline', lead_id: activeLeads[0].id }, { status: 409 })
  }

  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('agency_id', profile.agency_id)
    .order('position', { ascending: true })
    .limit(1)
    .single()
  if (!firstStage) return NextResponse.json({ error: 'Pipeline sem etapas' }, { status: 400 })

  const details = (person.details ?? {}) as Record<string, unknown>
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      agency_id: profile.agency_id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      stage_id: firstStage.id,
      person_id: person.id,
      assigned_to: person.assigned_to ?? user.id,
      zone: (details.search_zone ?? details.selling_zone ?? null) as string | null,
      typology: (details.typology ?? null) as string | null,
      source: 'outro',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead_id: lead.id }, { status: 201 })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // Apagar as leads ativas (não fechadas/perdidas) ligadas a este contacto.
  const { data: activeLeads } = await supabase
    .from('leads')
    .select('id, pipeline_stages!inner(is_won, is_lost)')
    .eq('person_id', id)
    .eq('agency_id', profile.agency_id)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)

  const ids = (activeLeads ?? []).map(l => l.id)
  if (ids.length > 0) {
    const { error } = await supabase.from('leads').delete().in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ removed: ids.length })
}
