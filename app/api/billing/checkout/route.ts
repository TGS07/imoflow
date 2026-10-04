import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { PLANS, type PlanId } from '@/lib/stripe/plans'
import { NextResponse } from 'next/server'

const PAID_PLANS: PlanId[] = ['starter', 'essential', 'pro']

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let targetPlan: PlanId
  try {
    const body = await request.json()
    targetPlan = body.planId
  } catch {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }

  if (!PAID_PLANS.includes(targetPlan)) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .select('id, email, stripe_customer_id')
    .eq('id', profile.agency_id)
    .single()

  if (agencyError || !agency) {
    return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
  }

  const plan = PLANS[targetPlan]
  if (!plan.priceId) {
    return NextResponse.json({ error: `Plano ${targetPlan} não está configurado (STRIPE_${targetPlan.toUpperCase()}_PRICE_ID em falta)` }, { status: 500 })
  }

  let customerId = agency.stripe_customer_id as string | null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: agency.email,
      metadata: { agency_id: agency.id },
    })
    customerId = customer.id

    const { error: updateError } = await supabase
      .from('agencies')
      .update({ stripe_customer_id: customerId })
      .eq('id', agency.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  const { origin } = new URL(request.url)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: agency.id,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${origin}/settings/billing?checkout=success`,
    cancel_url: `${origin}/settings/billing?checkout=cancelled`,
    metadata: { agency_id: agency.id, plan_id: targetPlan },
    subscription_data: {
      metadata: { agency_id: agency.id, plan_id: targetPlan },
    },
  })

  if (!session.url) {
    return NextResponse.json({ error: 'Não foi possível criar a sessão de checkout' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
