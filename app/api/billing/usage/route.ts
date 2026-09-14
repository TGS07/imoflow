import { createClient } from '@/lib/supabase/server'
import { checkLimit, type LimitResource } from '@/lib/stripe/limits'
import { getPlan, type PlanId } from '@/lib/stripe/plans'
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
    .select('plan')
    .eq('id', profile.agency_id)
    .single()

  if (agencyError || !agency) {
    return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
  }

  const planId = (agency.plan as PlanId | null) ?? 'free'
  const plan = getPlan(planId)

  const results = await Promise.all(
    RESOURCES.map(async (resource) => {
      const result = await checkLimit(supabase, profile.agency_id, resource)
      return { resource, ...result }
    })
  )

  return NextResponse.json({
    plan: planId,
    planName: plan.name,
    usage: results,
  })
}
