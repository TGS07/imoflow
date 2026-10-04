export type PlanId = 'free' | 'trial' | 'starter' | 'essential' | 'pro'

export type PlanLimits = {
  leads: number
  people: number
  properties: number
  members: number
  automations: number
}

export type Plan = {
  name: string
  priceId: string | null
  priceDisplay: string | null
  limits: PlanLimits
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    name: 'Free',
    priceId: null,
    priceDisplay: null,
    limits: {
      leads: 5,
      people: 5,
      properties: 3,
      members: 1,
      automations: 0,
    },
  },
  trial: {
    name: 'Trial',
    priceId: null,
    priceDisplay: null,
    limits: {
      leads: Infinity,
      people: Infinity,
      properties: Infinity,
      members: 5,
      automations: 10,
    },
  },
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID ?? null,
    priceDisplay: '49€/mês',
    limits: {
      leads: 25,
      people: 50,
      properties: 15,
      members: 1,
      automations: 0,
    },
  },
  essential: {
    name: 'Essencial',
    priceId: process.env.STRIPE_ESSENTIAL_PRICE_ID ?? null,
    priceDisplay: '89€/mês',
    limits: {
      leads: Infinity,
      people: Infinity,
      properties: Infinity,
      members: 5,
      automations: 10,
    },
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    priceDisplay: '149€/mês',
    limits: {
      leads: Infinity,
      people: Infinity,
      properties: Infinity,
      members: 10,
      automations: Infinity,
    },
  },
}

function isPlanId(value: string | null | undefined): value is PlanId {
  return value === 'free' || value === 'trial' || value === 'starter' || value === 'essential' || value === 'pro'
}

export function getPlan(planId: string | null | undefined): Plan {
  return isPlanId(planId) ? PLANS[planId] : PLANS.free
}

export function getEffectivePlanId(plan: string | null | undefined, trialEndsAt: string | null | undefined): PlanId {
  if (plan === 'trial') {
    if (!trialEndsAt) return 'free'
    return new Date(trialEndsAt) > new Date() ? 'trial' : 'free'
  }
  return isPlanId(plan) ? plan : 'free'
}
