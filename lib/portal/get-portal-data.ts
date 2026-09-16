import type { SupabaseClient } from '@supabase/supabase-js'
import type { Property } from '@/types'
import { getRecommendedProperties, type LeadPreferenceRow } from './recommended-properties'

export type PortalPipelineProgress = {
  stage_name: string
  position: number
  total: number
  is_won: boolean
  is_lost: boolean
}

export type PortalAgent = {
  name: string
  email: string
}

export type PortalRecommendedProperty = Property & { is_favorited: boolean }

export type PortalData = {
  lead_id: string
  lead_name: string
  agency: {
    name: string
    logo_url: string | null
  }
  agent: PortalAgent | null
  progress: PortalPipelineProgress | null
  properties: PortalRecommendedProperty[]
}

/**
 * Monta toda a informação necessária para o portal de cliente a partir de um
 * portal_token. Usada tanto pela página pública (SSR) como pelo GET da rota
 * de API, com um cliente service-role — o token na URL É a autenticação,
 * mesmo modelo dos restantes feeds públicos (feed_token, calendar_token).
 * Devolve null quando o token não corresponde a nenhum lead.
 */
export async function getPortalData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  token: string
): Promise<PortalData | null> {
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, agency_id, name, zone, typology, budget, assigned_to, stage_id, pipeline_id')
    .eq('portal_token', token)
    .maybeSingle()

  if (leadError || !lead) return null

  const [agencyRes, agentRes, preferencesRes, currentStageRes] = await Promise.all([
    supabase.from('agencies').select('name, logo_url, email').eq('id', lead.agency_id).maybeSingle(),
    lead.assigned_to
      ? supabase.from('users').select('name, email').eq('id', lead.assigned_to).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('lead_preferences')
      .select('zonas, tipologia_min, preco_max, is_active')
      .eq('lead_id', lead.id)
      .maybeSingle(),
    lead.stage_id
      ? supabase.from('pipeline_stages').select('name, position, is_won, is_lost').eq('id', lead.stage_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const agency = agencyRes.data as { name: string; logo_url: string | null; email: string } | null
  const agentRow = (agentRes as { data: { name: string; email: string } | null }).data
  const preferences = (preferencesRes.data ?? null) as LeadPreferenceRow
  const currentStage = (currentStageRes as { data: { name: string; position: number; is_won: boolean; is_lost: boolean } | null }).data

  let progress: PortalPipelineProgress | null = null
  if (currentStage && lead.pipeline_id) {
    const { data: stages } = await supabase
      .from('pipeline_stages')
      .select('id, position')
      .eq('pipeline_id', lead.pipeline_id)
      .order('position', { ascending: true })

    const total = stages?.length ?? 0
    if (total > 0) {
      progress = {
        stage_name: currentStage.name,
        position: currentStage.position,
        total,
        is_won: currentStage.is_won,
        is_lost: currentStage.is_lost,
      }
    }
  }

  const agent: PortalAgent | null = agentRow
    ? { name: agentRow.name, email: agentRow.email }
    : agency?.email
      ? { name: agency.name, email: agency.email }
      : null

  const properties = await getRecommendedProperties(
    supabase,
    lead.agency_id,
    { zone: lead.zone, typology: lead.typology, budget: lead.budget },
    preferences
  )

  let favoritedIds = new Set<string>()
  if (properties.length > 0) {
    const { data: favorites } = await supabase
      .from('portal_views')
      .select('property_id')
      .eq('lead_id', lead.id)
      .eq('action', 'favorite')
      .in('property_id', properties.map(p => p.id))

    favoritedIds = new Set((favorites ?? []).map((f: { property_id: string }) => f.property_id))
  }

  return {
    lead_id: lead.id,
    lead_name: lead.name,
    agency: {
      name: agency?.name ?? 'ImoFlow',
      logo_url: agency?.logo_url ?? null,
    },
    agent,
    progress,
    properties: properties.map(p => ({ ...p, is_favorited: favoritedIds.has(p.id) })),
  }
}
