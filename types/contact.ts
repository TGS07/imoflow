// types/contact.ts
import type { ContactTypeKey, CapacityBand } from '@/lib/contacts/constants'

export type ContactTemperature = 'quente' | 'morno' | 'frio'

export type ContactDetails = {
  // comprador / investidor
  looking_for?: string
  search_zone?: string
  temperature?: ContactTemperature
  already_bought?: boolean
  // vendedor
  selling_property?: string
  selling_zone?: string
  selling_price?: number
  typology?: string
  has_garage?: boolean
  has_balcony?: boolean
  has_exclusivity?: boolean
  is_active_seller?: boolean
  // serviço
  service_type?: string
}

export type ContactInteractionType = 'chamada' | 'visita' | 'email' | 'whatsapp' | 'nota'

export type ContactInteraction = {
  id: string
  agency_id: string
  person_id: string
  user_id: string | null
  type: ContactInteractionType
  note: string | null
  created_at: string
  users?: { name: string; avatar_initials: string }
}

export type { ContactTypeKey, CapacityBand }
