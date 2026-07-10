// lib/contacts/constants.ts
export type ContactTypeKey = 'comprador' | 'vendedor' | 'investidor' | 'consultor'

export const CONTACT_TYPES: { key: ContactTypeKey; label: string; plural: string; color: string }[] = [
  { key: 'comprador',  label: 'Comprador',  plural: 'Compradores',  color: '#3B82F6' }, // azul suave
  { key: 'vendedor',   label: 'Vendedor',   plural: 'Vendedores',   color: '#10B981' }, // verde suave
  { key: 'investidor', label: 'Investidor', plural: 'Investidores', color: '#8B5CF6' }, // roxo suave
  { key: 'consultor',  label: 'Consultor Imobiliário', plural: 'Consultores Imobiliários', color: '#14B8A6' }, // teal suave
]

export function contactTypeMeta(key: string) {
  return CONTACT_TYPES.find(t => t.key === key)
}

export type CapacityBand = 'muito_baixo' | 'baixo' | 'medio' | 'medio_alto' | 'alto' | 'altissimo'

export const CAPACITY_BANDS: { key: CapacityBand; label: string; range: string; max: number }[] = [
  { key: 'muito_baixo', label: 'Muito baixo', range: '< 250k',      max: 250_000 },
  { key: 'baixo',       label: 'Baixo',       range: '250k – 500k', max: 500_000 },
  { key: 'medio',       label: 'Médio',       range: '500k – 1M',   max: 1_000_000 },
  { key: 'medio_alto',  label: 'Médio-alto',  range: '1M – 2.5M',   max: 2_500_000 },
  { key: 'alto',        label: 'Alto',        range: '2.5M – 5M',   max: 5_000_000 },
  { key: 'altissimo',   label: 'Altíssimo',   range: '5M+',         max: Infinity },
]

export function capacityMeta(key: string | null | undefined) {
  return CAPACITY_BANDS.find(b => b.key === key)
}

// Mapeia um valor de orçamento (€) para a banda de capacidade financeira.
export function budgetToCapacity(budget: number | null | undefined): CapacityBand | null {
  if (budget == null || budget <= 0) return null
  for (const b of CAPACITY_BANDS) if (budget < b.max) return b.key
  return 'altissimo'
}

export const CONTACT_SOURCES = ['idealista', 'site', 'referencia', 'audio', 'manual', 'outro'] as const
export type ContactSource = typeof CONTACT_SOURCES[number]

export const SOURCE_LABELS: Record<ContactSource, string> = {
  idealista: 'Idealista', site: 'Site', referencia: 'Referência',
  audio: 'Áudio', manual: 'Manual', outro: 'Outro',
}
