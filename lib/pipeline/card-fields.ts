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
      if (!lead.last_call) return null
      const date = new Date(lead.last_call.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
      return `📞 ${lead.last_call.note || 'Chamada'} · ${date}`
    }
    case 'source': return lead.source
    // As notas editam-se na ficha do contacto — essas têm prioridade
    case 'notes': return lead.people?.notes || lead.notes || null
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
