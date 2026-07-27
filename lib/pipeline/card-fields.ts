import type { Lead, PipelineCardField } from '@/types'

export type PipelineCardFields = { primary: PipelineCardField; secondary: PipelineCardField }

// Valor de um campo configurável do card; null quando o lead não o tem.
export function cardFieldValue(lead: Lead, field: PipelineCardField): string | null {
  switch (field) {
    // O contacto ligado é a fonte da verdade para o nome — lead.name é só
    // uma cópia guardada na criação, que fica desatualizada se o contacto
    // for renomeado depois.
    case 'name': return lead.people?.name ?? lead.name
    case 'zone': return lead.zone
    case 'typology': return lead.typology
    case 'property': return lead.properties ? (lead.properties.reference ?? lead.properties.title) : null
    case 'value': {
      const v = lead.deal_value ?? lead.budget
      return v ? `${(v / 1000).toFixed(0)}K€` : null
    }
  }
}

// Dias desde que o lead entrou na etapa atual. `stage_entered_at` é
// reposto automaticamente pela base de dados sempre que `stage_id` muda
// (trigger `leads_set_stage_entered_at`), por isso nunca precisa de ser
// calculado/atualizado manualmente no cliente — só lido.
export function daysInStage(lead: Lead): number {
  return Math.floor((Date.now() - new Date(lead.stage_entered_at).getTime()) / 86400000)
}
