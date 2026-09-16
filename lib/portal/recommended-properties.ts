import type { SupabaseClient } from '@supabase/supabase-js'
import type { Property } from '@/types'

// Mesma ordem usada em app/(app)/leads/[id]/page.tsx (TIPOLOGIAS) para
// comparar tipologias ("T2" >= "T1", etc.).
const TIPOLOGIAS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5+']

const RECOMMENDED_LIMIT = 12
const FALLBACK_LIMIT = 6

export type LeadPreferenceRow = {
  zonas: string[] | null
  tipologia_min: string | null
  preco_max: number | null
  is_active: boolean
} | null

export type LeadCriteriaSource = {
  zone: string | null
  typology: string | null
  budget: number | null
}

type Criteria = {
  zonas: string[]
  tipologiaMin: string | null
  precoMax: number | null
}

function resolveCriteria(lead: LeadCriteriaSource, preferences: LeadPreferenceRow): Criteria | null {
  // Preferimos lead_preferences (mais rica: várias zonas, extras) quando
  // existe e está ativa; caso contrário caímos nas colunas simples do lead.
  if (preferences && preferences.is_active) {
    return {
      zonas: preferences.zonas ?? [],
      tipologiaMin: preferences.tipologia_min,
      precoMax: preferences.preco_max,
    }
  }

  return {
    zonas: lead.zone ? [lead.zone] : [],
    tipologiaMin: lead.typology,
    precoMax: lead.budget,
  }
}

function hasAnyCriteria(criteria: Criteria): boolean {
  return criteria.zonas.length > 0 || !!criteria.tipologiaMin || criteria.precoMax != null
}

function matchesZone(propertyZone: string | null, zonas: string[]): boolean {
  if (zonas.length === 0) return true
  if (!propertyZone) return false
  const normalized = propertyZone.trim().toLowerCase()
  return zonas.some(z => z.trim().toLowerCase() === normalized)
}

function matchesPrice(price: number | null, precoMax: number | null): boolean {
  if (precoMax == null) return true
  if (price == null) return false
  return price <= precoMax
}

function matchesTypology(typology: string | null, tipologiaMin: string | null): boolean {
  if (!tipologiaMin) return true
  if (!typology) return false
  const minIdx = TIPOLOGIAS.indexOf(tipologiaMin)
  const idx = TIPOLOGIAS.indexOf(typology)
  if (minIdx === -1 || idx === -1) return false
  return idx >= minIdx
}

export async function getRecommendedProperties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  agencyId: string,
  lead: LeadCriteriaSource,
  preferences: LeadPreferenceRow
): Promise<Property[]> {
  const criteria = resolveCriteria(lead, preferences)

  if (!criteria || !hasAnyCriteria(criteria)) {
    // Sem qualquer critério: mostramos os imóveis disponíveis mais recentes,
    // para o portal nunca ficar vazio.
    const { data } = await supabase
      .from('properties')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('status', 'disponivel')
      .order('created_at', { ascending: false })
      .limit(FALLBACK_LIMIT)

    return (data ?? []) as Property[]
  }

  const { data } = await supabase
    .from('properties')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('status', 'disponivel')
    .order('created_at', { ascending: false })

  const all = (data ?? []) as Property[]

  const matched = all.filter(p =>
    matchesZone(p.zone, criteria.zonas) &&
    matchesPrice(p.price, criteria.precoMax) &&
    matchesTypology(p.typology, criteria.tipologiaMin)
  )

  return matched.slice(0, RECOMMENDED_LIMIT)
}
