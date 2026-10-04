import type { SupabaseClient } from '@supabase/supabase-js'
import { getPlan, getEffectivePlanId, type PlanId } from './plans'

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

export async function checkLimit(
  supabase: SupabaseClient,
  agencyId: string,
  resource: LimitResource,
  knownPlanId?: PlanId | null,
  knownTrialEndsAt?: string | null
): Promise<CheckLimitResult> {
  let effectivePlanId: PlanId

  if (knownPlanId !== undefined) {
    effectivePlanId = getEffectivePlanId(knownPlanId, knownTrialEndsAt)
  } else {
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('plan, trial_ends_at')
      .eq('id', agencyId)
      .single()

    if (agencyError) throw agencyError
    effectivePlanId = getEffectivePlanId(agency?.plan, agency?.trial_ends_at)
  }

  const plan = getPlan(effectivePlanId)
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
