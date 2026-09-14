import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe/client'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

// Este endpoint é chamado diretamente pelo Stripe (sem sessão de user) — a
// autenticidade do pedido é garantida pela verificação da assinatura HMAC
// (stripe-signature), não por cookies/auth. Por isso usa sempre o cliente
// service-role para as escritas.

async function getAgencyIdFromSession(session: Stripe.Checkout.Session): Promise<string | null> {
  // client_reference_id é definido em app/api/billing/checkout/route.ts como
  // o agency_id — é a forma mais robusta de identificar a agency, porque não
  // depende de já existir stripe_customer_id gravado na BD. metadata.agency_id
  // funciona como fallback (mesmo valor, gravado por redundância).
  return session.client_reference_id ?? (session.metadata?.agency_id as string | undefined) ?? null
}

function getAgencyIdFromSubscription(subscription: Stripe.Subscription): string | null {
  return (subscription.metadata?.agency_id as string | undefined) ?? null
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 })
  }

  const supabase = createServiceClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const agencyId = await getAgencyIdFromSession(session)

      if (!agencyId) {
        console.error('[stripe webhook] checkout.session.completed sem agency_id identificável', session.id)
        break
      }

      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null

      const { error } = await supabase
        .from('agencies')
        .update({
          plan: 'pro',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        })
        .eq('id', agencyId)

      if (error) console.error('[stripe webhook] falha ao atualizar agency após checkout', error)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      let agencyId = getAgencyIdFromSubscription(subscription)

      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

      if (!agencyId) {
        // Fallback: procura a agency pelo stripe_customer_id, caso a
        // subscription não tenha sido criada com metadata.agency_id.
        const { data: agency } = await supabase
          .from('agencies')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        agencyId = agency?.id ?? null
      }

      if (!agencyId) {
        console.error('[stripe webhook] customer.subscription.updated sem agency identificável', subscription.id)
        break
      }

      const activeStatuses: Stripe.Subscription.Status[] = ['active', 'trialing']
      const plan = activeStatuses.includes(subscription.status) ? 'pro' : 'free'

      const { error } = await supabase
        .from('agencies')
        .update({
          plan,
          stripe_subscription_id: subscription.id,
        })
        .eq('id', agencyId)

      if (error) console.error('[stripe webhook] falha ao atualizar agency após subscription.updated', error)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      let agencyId = getAgencyIdFromSubscription(subscription)

      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

      if (!agencyId) {
        const { data: agency } = await supabase
          .from('agencies')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        agencyId = agency?.id ?? null
      }

      if (!agencyId) {
        console.error('[stripe webhook] customer.subscription.deleted sem agency identificável', subscription.id)
        break
      }

      const { error } = await supabase
        .from('agencies')
        .update({
          plan: 'free',
          stripe_subscription_id: null,
        })
        .eq('id', agencyId)

      if (error) console.error('[stripe webhook] falha ao atualizar agency após subscription.deleted', error)
      break
    }

    default:
      // Eventos não tratados são ignorados propositadamente.
      break
  }

  return NextResponse.json({ received: true })
}
