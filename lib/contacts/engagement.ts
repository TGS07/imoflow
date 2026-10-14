import type { ContactTemperature, InteractionOutcome, PropertyVisitActivity } from '@/types'

// Temperatura do contacto: escolhida à mão na ficha, ou atualizada sozinha ao
// registar uma chamada (atendeu → quente, não atendeu → frio).
export const TEMPERATURES: { key: ContactTemperature; label: string; emoji: string; color: string }[] = [
  { key: 'quente', label: 'Quente', emoji: '🔥', color: '#DC2626' },
  { key: 'neutro', label: 'Neutro', emoji: '●', color: '#A8A29E' },
  { key: 'frio', label: 'Frio', emoji: '❄', color: '#2563EB' },
]

export function temperatureMeta(t: ContactTemperature | null | undefined) {
  return TEMPERATURES.find(x => x.key === t) ?? null
}

// Ordem para "mais quentes primeiro" (sem temperatura = neutro)
export function temperatureRank(t: ContactTemperature | null | undefined): number {
  return t === 'quente' ? 0 : t === 'frio' ? 2 : 1
}

export function temperatureFromOutcome(type: string, outcome: InteractionOutcome | null | undefined): ContactTemperature | null {
  if (type !== 'chamada') return null
  if (outcome === 'atendeu') return 'quente'
  if (outcome === 'nao_atendeu') return 'frio'
  return null
}

export const OUTCOME_LABELS: Record<InteractionOutcome, string> = {
  atendeu: 'Atendeu',
  nao_atendeu: 'Não atendeu',
  whatsapp: 'WhatsApp',
  enviado: 'Enviado',
  respondido: 'Respondido',
}

export const OUTCOME_COLORS: Record<InteractionOutcome, string> = {
  atendeu: '#16A34A',
  nao_atendeu: '#DC2626',
  whatsapp: '#25A244',
  enviado: '#B07D2E',
  respondido: '#2563EB',
}

// Opções de resultado por tipo de interação
export const OUTCOMES_BY_TYPE: Record<string, InteractionOutcome[]> = {
  chamada: ['atendeu', 'nao_atendeu', 'whatsapp'],
  email: ['enviado', 'respondido'],
  whatsapp: ['enviado', 'respondido'],
}

// Tipos que contam como "contacto feito" (para a contagem desde o último contacto)
export const CONTACT_INTERACTION_TYPES = ['chamada', 'email', 'whatsapp'] as const

export const VISIT_ACTIVITY: { key: PropertyVisitActivity; label: string; color: string }[] = [
  { key: 'muitas', label: 'Muitas visitas', color: '#16A34A' },
  { key: 'poucas', label: 'Poucas visitas', color: '#EA8A1A' },
  { key: 'nenhuma', label: 'Sem visitas', color: '#EA580C' },
]

export const TRAIT_SUGGESTIONS = [
  'Ligar ao fim de semana',
  'Ligar de manhã',
  'Ligar ao fim do dia',
  'Ter calma, ser paciente',
  'Prefere WhatsApp',
  'Prefere email',
  'Decide rápido',
  'Muito detalhista',
  'Sensível ao preço',
]

export const NEXT_CALL_PRESETS = [1, 2, 3, 7, 14, 30]

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// next_call_at é uma data (YYYY-MM-DD). Dias até à chamada (negativo = atrasada).
export function daysUntil(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  const target = new Date(y, m - 1, d)
  return Math.round((target.getTime() - startOfToday().getTime()) / 86400000)
}

export function dateInDays(days: number): string {
  const d = startOfToday()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function nextCallLabel(date: string): string {
  const n = daysUntil(date)
  if (n === 0) return 'Ligar hoje'
  if (n < 0) return `Ligar · atrasada ${-n} dia${n === -1 ? '' : 's'}`
  if (n === 1) return 'Ligar amanhã'
  return `Ligar em ${n} dias`
}
