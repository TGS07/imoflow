import type { PlanId } from './plans'

export type Feature =
  | 'automations'
  | 'reports'
  | 'templates'
  | 'recommendations'
  | 'portal'
  | 'idealista'
  | 'whatsapp'
  | 'forms_unlimited'
  | 'api_access'

const PLAN_FEATURES: Record<PlanId, Feature[]> = {
  free: [],
  trial: ['automations', 'reports', 'templates', 'recommendations', 'forms_unlimited'],
  starter: [],
  essential: ['automations', 'reports', 'templates', 'recommendations', 'forms_unlimited'],
  pro: ['automations', 'reports', 'templates', 'recommendations', 'portal', 'idealista', 'whatsapp', 'forms_unlimited', 'api_access'],
}

export function hasFeature(planId: PlanId, feature: Feature): boolean {
  return PLAN_FEATURES[planId].includes(feature)
}

export function getPlanFeatures(planId: PlanId): Feature[] {
  return PLAN_FEATURES[planId]
}
