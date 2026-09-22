import type { Lead, PipelineCardField } from '@/types'

export type PipelineCardFields = {
  primary: PipelineCardField
  secondary: PipelineCardField
  all: PipelineCardField[]
}

const PROPERTY_TYPE_SHORT: Record<string, string> = {
  apartamento: 'AP',
  moradia: 'M',
  terreno: 'T',
  loja: 'Loja',
  escritorio: 'Esc.',
  armazem: 'Arm.',
  outro: 'Outro',
}

export function cardFieldValue(lead: Lead, field: PipelineCardField): string | null {
  switch (field) {
    case 'name': return lead.people?.name ?? lead.name
    case 'phone': return lead.people?.phone ?? lead.phone
    case 'email': return lead.people?.email ?? lead.email
    case 'zone': return lead.zone
    case 'typology': return lead.typology
    case 'property': return lead.properties ? (lead.properties.reference ?? lead.properties.title) : null
    case 'property_ref': return lead.properties?.reference ?? null
    case 'property_type': {
      const raw = lead.properties?.type ?? lead.property_type
      return raw ? (PROPERTY_TYPE_SHORT[raw] ?? raw) : null
    }
    case 'value': {
      const v = lead.deal_value ?? lead.budget
      return v ? `${(v / 1000).toFixed(0)}K€` : null
    }
    case 'call_status': {
      const calls = lead.contacts?.filter(c => c.type === 'chamada')
      if (!calls?.length) return null
      const last = calls.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      return last.title
    }
    case 'source': return lead.source
    case 'notes': return lead.notes ?? lead.people?.notes ?? null
  }
}

export function daysInStage(lead: Lead): number {
  return Math.floor((Date.now() - new Date(lead.stage_entered_at).getTime()) / 86400000)
}

export const CARD_FIELD_LABELS: Record<PipelineCardField, string> = {
  name: 'Nome',
  phone: 'Telefone',
  email: 'Email',
  zone: 'Zona',
  typology: 'Tipologia',
  property: 'Imóvel',
  property_ref: 'Ref. Imóvel',
  property_type: 'Tipo (AP/M/T)',
  value: 'Valor',
  call_status: 'Estado chamada',
  source: 'Fonte',
  notes: 'Notas',
}
