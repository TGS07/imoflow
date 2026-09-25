// lib/contacts/constants.ts
export type ContactTypeKey = 'comprador' | 'vendedor' | 'investidor' | 'consultor' | 'servico'

export const CONTACT_TYPES: { key: ContactTypeKey; label: string; plural: string; color: string; avatarBg: string }[] = [
  { key: 'comprador',  label: 'Comprador',  plural: 'Compradores',  color: '#6B8DB5', avatarBg: '#3A4F63' },
  { key: 'vendedor',   label: 'Vendedor',   plural: 'Vendedores',   color: '#5A9E84', avatarBg: '#354F44' },
  { key: 'investidor', label: 'Investidor', plural: 'Investidores', color: '#8B7DB5', avatarBg: '#4A4260' },
  { key: 'consultor',  label: 'Consultor Imobiliário', plural: 'Consultores Imobiliários', color: '#5EA8A0', avatarBg: '#344E4A' },
  { key: 'servico',    label: 'Serviço',    plural: 'Serviços',     color: '#A08050', avatarBg: '#4A3F2E' },
]

export function contactTypeMeta(key: string) {
  return CONTACT_TYPES.find(t => t.key === key)
}

const AVATAR_PALETTE = [
  { bg: '#3A4F63', text: '#B0C4D8' },
  { bg: '#354F44', text: '#A8CCBA' },
  { bg: '#4A4260', text: '#BEB4D4' },
  { bg: '#344E4A', text: '#A4C8C2' },
  { bg: '#4A3F2E', text: '#C4AD84' },
  { bg: '#4A3346', text: '#C4A0B8' },
]

export function avatarColor(name: string, types?: string[]): { bg: string; text: string } {
  if (types?.length) {
    const idx = CONTACT_TYPES.findIndex(t => t.key === types[0])
    if (idx >= 0) return AVATAR_PALETTE[idx]
  }
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
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

export const CONTACT_SOURCES = ['idealista', 'site', 'referencia', 'audio', 'manual', 'outro'] as const
export type ContactSource = typeof CONTACT_SOURCES[number]

export const SOURCE_LABELS: Record<ContactSource, string> = {
  idealista: 'Idealista', site: 'Site', referencia: 'Referência',
  audio: 'Áudio', manual: 'Manual', outro: 'Outro',
}
