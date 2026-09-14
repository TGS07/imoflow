// Definição dos planos e respetivos limites de uso.
// Mantém consistência com o que está prometido publicamente em
// components/landing/Pricing.tsx (Free: até 20 leads, 1 utilizador;
// Pro: ilimitado, até 10 utilizadores, automações avançadas).
//
// `Infinity` é usado para "ilimitado" — lib/stripe/limits.ts trata este
// valor como um atalho para não precisar de contar linhas na BD.

export type PlanId = 'free' | 'pro'

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
  limits: PlanLimits
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    name: 'Free',
    priceId: null,
    limits: {
      leads: 20,
      people: 20,
      properties: 10,
      members: 1,
      automations: 3,
    },
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    limits: {
      leads: Infinity,
      people: Infinity,
      properties: Infinity,
      members: 10,
      automations: Infinity,
    },
  },
}

export function isPlanId(value: string | null | undefined): value is PlanId {
  return value === 'free' || value === 'pro'
}

export function getPlan(planId: string | null | undefined): Plan {
  return isPlanId(planId) ? PLANS[planId] : PLANS.free
}
