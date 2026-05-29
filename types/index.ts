export type Agency = {
  id: string
  name: string
  email: string
  logo_url: string | null
  plan: 'free' | 'pro'
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

export type PipelineStage = {
  id: string
  agency_id: string
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
  created_at: string
  users?: User
  pipeline_stages?: PipelineStage
  custom_field_values?: CustomFieldValue[]
  people?: Person
  organizations?: Organization
}

export type Contact = {
  id: string
  lead_id: string
  user_id: string | null
  type: 'chamada' | 'visita' | 'email' | 'nota'
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
