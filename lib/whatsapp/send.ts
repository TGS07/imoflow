// Envio via WhatsApp Business API (Meta Cloud API).
// Requer configuração — ver docs/WHATSAPP_SETUP.md.

const GRAPH_API_VERSION = 'v21.0'

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

export async function sendWhatsAppMessage(phone: string, body: string): Promise<{ waMessageId: string }> {
  if (!isWhatsAppConfigured()) {
    throw new Error('WhatsApp Business API não configurada (ver docs/WHATSAPP_SETUP.md)')
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body },
      }),
    }
  )

  const data = await res.json()
  if (!res.ok) {
    throw new Error(`Meta API: ${data?.error?.message ?? res.statusText}`)
  }
  return { waMessageId: data?.messages?.[0]?.id ?? '' }
}
