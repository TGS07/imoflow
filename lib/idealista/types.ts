export interface Listing {
  titulo: string | null
  zona: string | null
  tipologia: string | null
  preco: number | null
  m2: number | null
  extras: string[]
  link: string | null
}

export interface ParsedEmail {
  listings: Listing[]
}

export interface MatchReason {
  zona_ok: boolean
  tipologia_ok: boolean
  preco_ok: boolean
  extras_ok: boolean
  explicacao: string
}

export interface LeadPreference {
  id: string
  lead_id: string
  lead_name: string
  lead_email: string | null
  lead_phone: string | null
  zonas: string[]
  tipologia_min: string | null
  preco_max: number | null
  extras: string[]
  agency_id: string
  agent_user_id: string | null
  agent_name: string | null
}
