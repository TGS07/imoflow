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

  // Passamos `planId` (já carregado acima) a `checkLimit` para que cada
  // chamada salte o `SELECT plan FROM agencies` e faça só a contagem —
  // evita repetir a mesma query 5 vezes (uma por resource).
  const results = await Promise.all(
    RESOURCES.map(async (resource) => {
      const result = await checkLimit(supabase, profile.agency_id, resource, planId)
      return { resource, ...result }
    })
  )

  // Nota: `limit: Infinity` não é serializável em JSON — `JSON.stringify`
  // converte-o em `null`. O cliente trata isso corretamente por já usar
  // `Number.isFinite(row.limit)` (que também é `false` para `null`), mas
  // fica aqui documentado para não ser confundido com um bug.
  return NextResponse.json({
    plan: planId,
    planName: plan.name,
    usage: results,
  })
}
