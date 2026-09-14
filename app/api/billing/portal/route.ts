import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
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
    .select('stripe_customer_id')
    .eq('id', profile.agency_id)
    .single()

  if (agencyError || !agency) {
    return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
  }

  if (!agency.stripe_customer_id) {
    return NextResponse.json(
      { error: 'Esta agência ainda não tem faturação configurada. Subscreva um plano primeiro.' },
      { status: 400 }
    )
  }

  const { origin } = new URL(request.url)

  const session = await stripe.billingPortal.sessions.create({
    customer: agency.stripe_customer_id,
    return_url: `${origin}/settings/billing`,
  })

  return NextResponse.json({ url: session.url })
}
