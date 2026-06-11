import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { triggerAutomations } from '@/lib/automations/engine'
import { normalizePhone } from '@/lib/whatsapp/utils'

// Webhook da WhatsApp Business API (Meta Cloud API).
// Configuração: ver docs/WHATSAPP_SETUP.md.

// GET: verificação do webhook pela Meta
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// POST: mensagens recebidas
export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ received: true })
  }

  try {
    await processWebhook(payload)
  } catch (err) {
    // Nunca devolver erro à Meta — senão reenviam o webhook em loop
    console.error('WhatsApp webhook error:', err)
  }

  return NextResponse.json({ received: true })
}

type WebhookMessage = {
  from?: string
  id?: string
  type?: string
  text?: { body?: string }
}

async function processWebhook(payload: unknown): Promise<void> {
  const body = payload as {
    entry?: { changes?: { value?: { messages?: WebhookMessage[] } }[] }[]
  }

  const messages = (body.entry ?? [])
    .flatMap(e => e.changes ?? [])
    .flatMap(c => c.value?.messages ?? [])
    .filter(m => m.type === 'text' && m.from && m.text?.body)

  if (messages.length === 0) return

  const supabase = createServiceClient()

  for (const message of messages) {
    const phone = normalizePhone(message.from!)
    const text = message.text!.body!

    // Encontrar a lead pelo telefone (compara os últimos 9 dígitos)
    const { data: leads } = await supabase
      .from('leads')
      .select('id, assigned_to, agency_id, phone')
      .not('phone', 'is', null)

    const lead = (leads ?? []).find(l => l.phone && normalizePhone(l.phone) === phone)

    // Registar a mensagem (mesmo sem lead associada, para não perder histórico)
    const { error: insertError } = await supabase.from('whatsapp_messages').insert({
      agency_id: lead?.agency_id ?? null,
      lead_id: lead?.id ?? null,
      direction: 'inbound',
      phone,
      body: text,
      wa_message_id: message.id ?? null,
    })
    if (insertError) console.error('Failed to log inbound whatsapp:', insertError.message)

    if (lead?.assigned_to && lead.agency_id) {
      await triggerAutomations({
        type: 'whatsapp_message_received',
        leadId: lead.id,
        userId: lead.assigned_to,
        agencyId: lead.agency_id,
        meta: { messageBody: text },
      }, supabase)
    }
  }
}
