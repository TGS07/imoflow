export type Agency = {
  id: string
  name: string
  email: string
  logo_url: string | null
  plan: 'free' | 'pro'
  email_from_name: string | null
  email_reply_to: string | null
  created_at: string
}

export type User = {
  id: string
  agency_id: string
  name: string
  email: string
  role: 'admin' | 'agent'
  avatar_initials: string
}

export type PipelineCardField = 'name' | 'zone' | 'property' | 'typology' | 'value'

export type Pipeline = {
  id: string
  agency_id: string
  name: string
  position: number
  card_primary_field: PipelineCardField
  card_secondary_field: PipelineCardField
  created_at: string
}

export type PipelineStage = {
  id: string
  agency_id: string
  pipeline_id: string | null
  name: string
  color: string
  position: number
  probability: number
  is_won: boolean
  is_lost: boolean
  created_at: string
}

export type CustomField = {
  id: string
  agency_id: string
  name: string
  field_type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'currency'
  options: string[] | null
  required: boolean
  position: number
  created_at: string
}

export type CustomFieldValue = {
  id: string
  lead_id: string
  field_id: string
  value_text: string | null
  value_number: number | null
  value_date: string | null
  value_json: unknown | null
  created_at: string
}

export type Person = {
  id: string
  agency_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  types: import('./contact').ContactTypeKey[]
  financial_capacity: import('./contact').CapacityBand | null
  source: string | null
  last_interaction_at: string | null
  details: import('./contact').ContactDetails
  is_regular: boolean
  regular_interval_days: number | null
  assigned_to: string | null
  birthday: string | null
  is_special: boolean
  special_notify_christmas: boolean
  special_notify_easter: boolean
  special_notify_birthday: boolean
  special_dates: import('./contact').ContactSpecialDate[]
  created_at: string
}

export type Organization = {
  id: string
  agency_id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export type PropertyType = 'apartamento' | 'moradia' | 'terreno' | 'loja' | 'escritorio' | 'armazem' | 'outro'
export type PropertyStatus = 'disponivel' | 'reservado' | 'vendido' | 'arrendado'
export type PropertyCondition = 'novo' | 'usado' | 'renovado' | 'em_construcao'

export type Property = {
  id: string
  agency_id: string
  reference: string | null
  title: string
  type: PropertyType
  status: PropertyStatus
  price: number | null
  area_m2: number | null
  typology: string | null
  bedrooms: number | null
  bathrooms: number | null
  floor: string | null
  condition: PropertyCondition | null
  address: string | null
  city: string | null
  zone: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  description: string | null
  features: string[]
  photos: string[]
  notes: string | null
  seller_id: string | null
  created_at: string
}

export type LeadSource = 'site' | 'instagram' | 'facebook' | 'referencia' | 'outro'

export type Lead = {
  id: string
  agency_id: string
  assigned_to: string | null
  name: string
  email: string | null
  phone: string | null
  stage_id: string
  score: number
  source: LeadSource
  budget: number | null
  zone: string | null
  typology: string | null
  notes: string | null
  deal_value: number | null
  expected_close_date: string | null
  person_id: string | null
  organization_id: string | null
  property_id: string | null
  pipeline_id: string | null
  is_regular: boolean
  regular_interval_days: number | null
  created_at: string
  users?: User
  pipeline_stages?: PipelineStage
  custom_field_values?: CustomFieldValue[]
  people?: Person
  organizations?: Organization
  properties?: Property
}

export type Contact = {
  id: string
  lead_id: string
  user_id: string | null
  type: 'chamada' | 'visita' | 'email' | 'whatsapp' | 'nota'
  title: string
  description: string | null
  note: string | null
  created_at: string
  users?: User
}

export type Task = {
  id: string
  lead_id: string
  assigned_to: string | null
  title: string
  due_date: string | null
  completed: boolean
  created_at: string
}

export type EmailSent = {
  id: string
  lead_id: string
  sent_by: string | null
  subject: string
  body: string
  status: 'sent' | 'failed'
  sent_at: string
}

export type { ActivityType, Activity } from './activity'
export type { AutomationTriggerType, AutomationActionType, AutomationRule, AutomationLog, AutomationEvent } from './automation'
export type { ReportPeriod, ReportKpis, ReportFunnelEntry, ReportSourceEntry, ReportTimeEntry, ReportAgentEntry, ReportsData } from './reports'
export type { WebFormField, WebForm } from './web-form'
export type { WhatsAppTemplate, WhatsAppMessage } from './whatsapp'
export { WEB_FORM_FIELD_LABELS, OPTIONAL_FORM_FIELDS } from './web-form'
export type { ContactDetails, ContactTemperature, ContactInteraction, ContactInteractionType, ContactSpecialDate } from './contact'
