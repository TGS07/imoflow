import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'
import { triggerAutomations } from '@/lib/automations/engine'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('leads')
    .select('*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost), custom_field_values(id, field_id, value_text, value_number, value_date, value_json), people(id, name, email, phone), organizations(id, name), properties(id, reference, title, price, type, status, zone, typology, area_m2)')
    .eq('id', id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { custom_fields: customFieldValues, ...leadData } = body

  const { data: before } = await supabase
    .from('leads')
    .select('stage_id, name, assigned_to, agency_id, pipeline_stages(name)')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('leads')
    .update(leadData)
    .eq('id', id)
    .select('*, pipeline_stages(id, name, color, position, probability, is_won, is_lost)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Upsert custom field values if provided
  if (customFieldValues && typeof customFieldValues === 'object') {
    for (const [fieldId, value] of Object.entries(customFieldValues)) {
      if (value === null || value === '' || value === undefined) {
        await supabase.from('custom_field_values').delete().eq('lead_id', id).eq('field_id', fieldId)
      } else {
        const row: Record<string, unknown> = { lead_id: id, field_id: fieldId, value_text: null, value_number: null, value_date: null, value_json: null }
        if (typeof value === 'number') row.value_number = value
        else if (Array.isArray(value)) row.value_json = value
        else if (typeof value === 'string') row.value_text = value
        await supabase.from('custom_field_values').upsert(row, { onConflict: 'lead_id,field_id' })
      }
    }
  }

  if (before && leadData.stage_id && leadData.stage_id !== before.stage_id && before.assigned_to && before.agency_id) {
    const newStageName = data.pipeline_stages?.name ?? 'desconhecida'
    const oldStageName = (before.pipeline_stages as unknown as { name: string } | null)?.name ?? 'desconhecida'
    await createNotification({
      userId: before.assigned_to,
      agencyId: before.agency_id,
      type: 'lead_stage_changed',
      title: `Lead ${before.name} movida para ${newStageName}`,
      body: `A lead ${before.name} foi movida de "${oldStageName}" para "${newStageName}".`,
      link: `/leads/${id}`,
    })

    // Disparar automações de stage_changed
    triggerAutomations({
      type: 'stage_changed',
      leadId: id,
      userId: user.id,
      agencyId: before.agency_id,
      meta: {
        toStageId: leadData.stage_id,
        toStageName: newStageName,
        pipelineId: data.pipeline_id ?? undefined,
      },
    }).catch(console.error)
  }

  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
