import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe/client'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getPlan } from '@/lib/stripe/plans'
import { sendTransactionalEmail } from '@/lib/email/transactional'
import { renderPlanConfirmed } from '@/lib/email/transactional-templates'

async function getAgencyIdFromSession(session: Stripe.Checkout.Session): Promise<string | null> {
  return session.client_reference_id ?? (session.metadata?.agency_id as string | undefined) ?? null
}

function getAgencyIdFromSubscription(subscription: Stripe.Subscription): string | null {
  return (subscription.metadata?.agency_id as string | undefined) ?? null
}

function getPlanFromMetadata(metadata: Stripe.Metadata | null): string {
  const planId = metadata?.plan_id
  if (planId === 'starter' || planId === 'essential' || planId === 'pro') return planId
  return 'pro'
}

export async function POST(request: Request) {
  const stripe = getStripe()
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
  let dbWriteFailed = false

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
      const planId = getPlanFromMetadata(session.metadata)

      const { error } = await supabase
        .from('agencies')
        .update({
          plan: planId,
          trial_ends_at: null,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        })
        .eq('id', agencyId)

      if (error) {
        console.error('[stripe webhook] falha ao atualizar agency após checkout', error)
        dbWriteFailed = true
      } else {
        const [{ data: agency }, { data: admin }] = await Promise.all([
          supabase.from('agencies').select('email').eq('id', agencyId).maybeSingle(),
          supabase
            .from('users')
            .select('name')
            .eq('agency_id', agencyId)
            .eq('role', 'admin')
            .limit(1)
            .maybeSingle(),
        ])
        const to = session.customer_details?.email ?? agency?.email
        if (to) {
          const plan = getPlan(planId)
          const confirmation = renderPlanConfirmed({
            name: admin?.name ?? '',
            planName: plan.name,
            priceDisplay: plan.priceDisplay,
          })
          await sendTransactionalEmail({ to, ...confirmation })
        }
      }
      break
    }

    case 'customer.subscription.updated': {
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
        console.error('[stripe webhook] customer.subscription.updated sem agency identificável', subscription.id)
        break
      }

      const activeStatuses: Stripe.Subscription.Status[] = ['active', 'trialing']
      const planId = activeStatuses.includes(subscription.status)
        ? getPlanFromMetadata(subscription.metadata)
        : 'free'

      const { error } = await supabase
        .from('agencies')
        .update({
          plan: planId,
          trial_ends_at: planId === 'free' ? null : undefined,
          stripe_subscription_id: subscription.id,
        })
        .eq('id', agencyId)

      if (error) {
        console.error('[stripe webhook] falha ao atualizar agency após subscription.updated', error)
        dbWriteFailed = true
      }
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
          trial_ends_at: null,
          stripe_subscription_id: null,
        })
        .eq('id', agencyId)

      if (error) {
        console.error('[stripe webhook] falha ao atualizar agency após subscription.deleted', error)
        dbWriteFailed = true
      }
      break
    }

    default:
      break
  }

  if (dbWriteFailed) {
    return NextResponse.json({ error: 'Falha ao gravar alterações na base de dados' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
