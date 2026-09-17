import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { PLANS } from '@/lib/stripe/plans'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const stripe = getStripe()
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
    .select('id, email, stripe_customer_id')
    .eq('id', profile.agency_id)
    .single()

  if (agencyError || !agency) {
    return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
  }

  const priceId = PLANS.pro.priceId
  if (!priceId) {
    return NextResponse.json({ error: 'Plano Pro não está configurado (STRIPE_PRO_PRICE_ID em falta)' }, { status: 500 })
  }

  // Reutiliza o Stripe Customer existente ou cria um novo associado à agency.
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

  // `client_reference_id` identifica a agency de forma robusta no webhook —
  // é sempre devolvido no evento checkout.session.completed, sem depender
  // de já existir stripe_customer_id gravado localmente.
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: agency.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/settings/billing?checkout=success`,
    cancel_url: `${origin}/settings/billing?checkout=cancelled`,
    metadata: { agency_id: agency.id },
    subscription_data: {
      metadata: { agency_id: agency.id },
    },
    // Managed Payments (Stripe como merchant of record) vem ativado por
    // omissão na conta e exige tax_code no produto, que não configurámos —
    // desativamos aqui para usar o modelo direto (Stripe apenas processa
    // o pagamento, sem responsabilidades fiscais assumidas pela Stripe).
    managed_payments: { enabled: false },
  })

  if (!session.url) {
    return NextResponse.json({ error: 'Não foi possível criar a sessão de checkout' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
