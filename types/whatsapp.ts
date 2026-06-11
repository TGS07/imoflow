export type WhatsAppTemplate = {
  id: string
  agency_id: string
  name: string
  body: string
  created_at: string
}

export type WhatsAppMessage = {
  id: string
  agency_id: string | null
  lead_id: string | null
  direction: 'inbound' | 'outbound'
  phone: string
  body: string
  wa_message_id: string | null
  created_at: string
}
