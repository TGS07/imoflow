import type { SupabaseClient } from '@supabase/supabase-js'
import { getPlan } from './plans'

export type LimitResource = 'leads' | 'people' | 'properties' | 'members' | 'automations'

const RESOURCE_TABLE: Record<LimitResource, string> = {
  leads: 'leads',
  people: 'people',
  properties: 'properties',
  members: 'users',
  automations: 'automation_rules',
}

export type CheckLimitResult = {
  allowed: boolean
  current: number
  limit: number
}

/**
 * Verifica se a agency ainda tem margem para criar mais um recurso do tipo
 * indicado, de acordo com o plano atual (`agencies.plan`) e os limites
 * definidos em lib/stripe/plans.ts.
 *
 * Faz `count: 'exact', head: true` (sem trazer as rows todas) — exceto
 * quando o limite é `Infinity`, caso em que nem sequer conta (otimização).
 */
export async function checkLimit(
  supabase: SupabaseClient,
  agencyId: string,
  resource: LimitResource
): Promise<CheckLimitResult> {
  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .select('plan')
    .eq('id', agencyId)
    .single()

  if (agencyError) throw agencyError

  const plan = getPlan(agency?.plan as string | null)
  const limit = plan.limits[resource]

  if (limit === Infinity) {
    return { allowed: true, current: 0, limit: Infinity }
  }

  const table = RESOURCE_TABLE[resource]
  const { count, error: countError } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agencyId)

  if (countError) throw countError

  const current = count ?? 0
  return { allowed: current < limit, current, limit }
}
