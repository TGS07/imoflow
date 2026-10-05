import { createServiceClient } from '@/lib/supabase/service'
import { getEffectivePlanId, type PlanId } from '@/lib/stripe/plans'

export type Audience = 'all' | 'trial' | 'paid' | 'free'
export const AUDIENCES: Audience[] = ['all', 'trial', 'paid', 'free']

export type Recipient = { id: string; email: string; plan: PlanId }

function matches(plan: PlanId, audience: Audience): boolean {
  if (audience === 'all') return true
  if (audience === 'trial') return plan === 'trial'
  if (audience === 'free') return plan === 'free'
  return plan === 'starter' || plan === 'essential' || plan === 'pro'
}

// Campanhas são marketing: quem cancelou a subscrição fica sempre de fora.
export async function loadRecipients(): Promise<Recipient[]> {
  const supabase = createServiceClient()
  const [users, agencies] = await Promise.all([
    supabase.from('users').select('id, email, agency_id').eq('product_updates_opt_out', false),
    supabase.from('agencies').select('id, plan, trial_ends_at'),
  ])
  if (users.error) throw new Error(users.error.message)
  if (agencies.error) throw new Error(agencies.error.message)

  const planByAgency = new Map(
    (agencies.data ?? []).map(a => [a.id, getEffectivePlanId(a.plan, a.trial_ends_at)])
  )
  return (users.data ?? [])
    .filter(u => !!u.email)
    .map(u => ({ id: u.id, email: u.email, plan: planByAgency.get(u.agency_id) ?? 'free' }))
}

export function filterAudience(recipients: Recipient[], audience: Audience): Recipient[] {
  return recipients.filter(r => matches(r.plan, audience))
}

export function countAudiences(recipients: Recipient[]): Record<Audience, number> {
  return {
    all: filterAudience(recipients, 'all').length,
    trial: filterAudience(recipients, 'trial').length,
    paid: filterAudience(recipients, 'paid').length,
    free: filterAudience(recipients, 'free').length,
  }
}
