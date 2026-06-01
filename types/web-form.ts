export type WebFormField = 'name' | 'email' | 'phone' | 'message' | 'zone' | 'typology' | 'budget'

export const WEB_FORM_FIELD_LABELS: Record<WebFormField, string> = {
  name: 'Nome completo',
  email: 'Email',
  phone: 'Telefone',
  message: 'Mensagem',
  zone: 'Zona de interesse',
  typology: 'Tipologia',
  budget: 'Orçamento (€)',
}

export const OPTIONAL_FORM_FIELDS: WebFormField[] = ['phone', 'message', 'zone', 'typology', 'budget']

export type WebForm = {
  id: string
  agency_id: string
  name: string
  description: string | null
  fields: WebFormField[]
  stage_id: string | null
  is_active: boolean
  created_at: string
  pipeline_stages?: { name: string } | null
}
