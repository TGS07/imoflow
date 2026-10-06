import { createClient } from '@/lib/supabase/server'
import { checkLimit, type LimitResource } from '@/lib/stripe/limits'
import { getPlan, getEffectivePlanId, type PlanId } from '@/lib/stripe/plans'
import { getPlanFeatures } from '@/lib/stripe/features'
import { NextResponse } from 'next/server'

const RESOURCES: LimitResource[] = ['leads', 'people', 'properties', 'members', 'automations']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .select('plan, trial_ends_at')
    .eq('id', profile.agency_id)
    .single()

  if (agencyError || !agency) {
    return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
  }

  const rawPlan = (agency.plan as PlanId | null) ?? 'free'
  const trialEndsAt = agency.trial_ends_at as string | null
  const effectivePlanId = getEffectivePlanId(rawPlan, trialEndsAt)
  const plan = getPlan(effectivePlanId)
  const features = getPlanFeatures(effectivePlanId)

  const results = await Promise.all(
    RESOURCES.map(async (resource) => {
      const result = await checkLimit(supabase, profile.agency_id, resource, rawPlan, trialEndsAt)
      return { resource, ...result }
    })
  )

  let trialDaysRemaining: number | null = null
  if (rawPlan === 'trial' && trialEndsAt) {
    const diff = new Date(trialEndsAt).getTime() - Date.now()
    trialDaysRemaining = Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
  }

  return NextResponse.json({
    plan: effectivePlanId,
    rawPlan: rawPlan,
    planName: plan.name,
    trialEndsAt,
    trialDaysRemaining,
    features,
    usage: results,
  })
}
