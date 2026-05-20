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

export type LeadStage = 'lead' | 'visita' | 'proposta' | 'negociacao' | 'fechado'
export type LeadSource = 'site' | 'instagram' | 'facebook' | 'referencia' | 'outro'

export type Lead = {
  id: string
  agency_id: string
  assigned_to: string | null
  name: string
  email: string | null
  phone: string | null
  stage: LeadStage
  score: number
  source: LeadSource
  budget: number | null
  zone: string | null
  typology: string | null
  notes: string | null
  created_at: string
  users?: User
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
