import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'
import { triggerAutomations } from '@/lib/automations/engine'
import { CONTACT_INTERACTION_TYPES } from '@/lib/contacts/engagement'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, agency_id')
    .eq('id', user.id)
    .single()
  if (profileError || !profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const stageId = searchParams.get('stage_id')
  const search = searchParams.get('search')
  const personId = searchParams.get('person_id')
  const pipelineId = searchParams.get('pipeline_id')
  const propertyId = searchParams.get('property_id')

  let query = supabase
    .from('leads')
    .select('*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost), pipelines(name), people(id, name, email, phone, types, notes, temperature, traits, next_call_at), organizations(id, name), properties(id, reference, title, price, type, visit_activity)')
    .eq('agency_id', profile.agency_id)
    .order('created_at', { ascending: false })

  if (profile.role === 'agent') query = query.eq('assigned_to', user.id)
  if (stageId) query = query.eq('stage_id', stageId)
  if (personId) query = query.eq('person_id', personId)
  if (pipelineId) query = query.eq('pipeline_id', pipelineId)
  if (propertyId) query = query.eq('property_id', propertyId)
  if (search) {
    const term = search.replace(/[%_\\]/g, '\\$&')
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // As chamadas são registadas por contacto (contact_interactions), não por
  // lead — anexar a última chamada de cada contacto (card "Estado chamada") e
  // a última chamada atendida para a contagem de dias (chamadas não atendidas,
  // emails e mensagens não reiniciam a contagem).
  const personIds = [...new Set(data.map(l => l.person_id).filter((v): v is string => !!v))]
  const lastCallByPerson = new Map<string, { note: string | null; outcome: string | null; created_at: string }>()
  const lastContactByPerson = new Map<string, string>()
  const visitActivityBySeller = new Map<string, string>()
  for (let i = 0; i < personIds.length; i += 200) {
    const chunk = personIds.slice(i, i + 200)
    const [{ data: interactions }, { data: sellerProps }] = await Promise.all([
      supabase
        .from('contact_interactions')
        .select('person_id, type, note, outcome, created_at')
        .in('type', CONTACT_INTERACTION_TYPES as unknown as string[])
        .in('person_id', chunk)
        .order('created_at', { ascending: false }),
      supabase
        .from('properties')
        .select('seller_id, visit_activity')
        .in('seller_id', chunk)
        .not('visit_activity', 'is', null),
    ])
    for (const c of interactions ?? []) {
      if (c.type === 'chamada' && c.outcome === 'atendeu' && !lastContactByPerson.has(c.person_id)) lastContactByPerson.set(c.person_id, c.created_at)
      if (c.type === 'chamada' && !lastCallByPerson.has(c.person_id)) lastCallByPerson.set(c.person_id, { note: c.note, outcome: c.outcome, created_at: c.created_at })
    }
    for (const p of sellerProps ?? []) {
      if (p.seller_id && !visitActivityBySeller.has(p.seller_id)) visitActivityBySeller.set(p.seller_id, p.visit_activity)
    }
  }

  return NextResponse.json(data.map(l => ({
    ...l,
    last_call: l.person_id ? lastCallByPerson.get(l.person_id) ?? null : null,
    last_contact_at: l.person_id ? lastContactByPerson.get(l.person_id) ?? null : null,
    // Estado de visitas: o imóvel do card; na falta, um imóvel que o contacto vende
    visit_activity: (l.properties as { visit_activity?: string | null } | null)?.visit_activity
      ?? (l.person_id ? visitActivityBySeller.get(l.person_id) ?? null : null),
  })))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json()
  const { custom_fields: customFieldValues, ...leadData } = body

  // Se não vier stage_id, usar a 1ª etapa da pipeline indicada (ou, na falta
  // de pipeline_id, a 1ª pipeline da agência). O trigger leads_ensure_pipeline
  // é o backstop, mas resolvemos aqui para devolver logo o stage correto.
  if (!leadData.stage_id) {
    let pipelineId = leadData.pipeline_id
    if (!pipelineId) {
      const { data: firstPipeline } = await supabase
        .from('pipelines')
        .select('id')
        .eq('agency_id', profile.agency_id)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle()
      pipelineId = firstPipeline?.id
      if (pipelineId) leadData.pipeline_id = pipelineId
    }
    if (pipelineId) {
      const { data: firstStage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', pipelineId)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (firstStage) leadData.stage_id = firstStage.id
    }
  } else {
    const { data: stage } = await supabase
      .from('pipeline_stages')
      .select('pipeline_id')
      .eq('id', leadData.stage_id)
      .eq('agency_id', profile.agency_id)
      .maybeSingle()
    if (!stage || (leadData.pipeline_id && stage.pipeline_id !== leadData.pipeline_id)) {
      return NextResponse.json({ error: 'A etapa não pertence à pipeline da lead' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('leads')
    .insert({ ...leadData, agency_id: profile.agency_id, assigned_to: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Nota: leads sem contacto ligado ganham um contacto novo automaticamente
  // (trigger `leads_ensure_contact` na base de dados — corre para qualquer
  // origem: app, formulário público ou o bot do Idealista a inserir direto).

  // Save custom field values if provided
  if (customFieldValues && typeof customFieldValues === 'object') {
    const rows = Object.entries(customFieldValues)
      .filter(([, v]) => v !== null && v !== '' && v !== undefined)
      .map(([fieldId, value]) => {
        const row: Record<string, unknown> = { lead_id: data.id, field_id: fieldId }
        if (typeof value === 'number') row.value_number = value
        else if (Array.isArray(value)) row.value_json = value
        else if (typeof value === 'string') row.value_text = value
        return row
      })

    if (rows.length > 0) {
      await supabase.from('custom_field_values').insert(rows)
    }
  }

  await createNotification({
    userId: user.id,
    agencyId: profile.agency_id,
    type: 'new_lead',
    title: `Nova lead: ${data.name}`,
    body: `Foi-te atribuida uma nova lead.${data.phone ? ` Telefone: ${data.phone}` : ''}`,
    link: `/leads/${data.id}`,
  })

  // Disparar automações de lead_created (sem await para não bloquear resposta)
  triggerAutomations({
    type: 'lead_created',
    leadId: data.id,
    userId: user.id,
    agencyId: profile.agency_id,
    meta: { pipelineId: data.pipeline_id ?? undefined },
  }).catch(console.error)

  return NextResponse.json(data, { status: 201 })
}
