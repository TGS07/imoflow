import type { SupabaseClient } from '@supabase/supabase-js'
import { resend } from '@/lib/resend'

// Endereço de envio verificado no Resend. Cada agência personaliza o nome de
// envio e o reply-to em Configurações → Agência (ver docs no Resend para
// verificar um domínio próprio).
const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'

type SendLeadEmailParams = {
  supabase: SupabaseClient
  leadId: string
  agencyId: string
  toEmail: string
  subject: string
  body: string
  sentBy: string | null
}

export type SendLeadEmailResult = { status: 'sent' | 'failed'; error?: string }

export async function sendLeadEmail(params: SendLeadEmailParams): Promise<SendLeadEmailResult> {
  const { supabase, leadId, agencyId, toEmail, subject, body, sentBy } = params

  const { data: agency } = await supabase
    .from('agencies')
    .select('name, email_from_name, email_reply_to')
    .eq('id', agencyId)
    .single()

  const fromName = agency?.email_from_name || agency?.name || 'ImoFlow'

  let status: 'sent' | 'failed' = 'sent'
  let errorMessage: string | undefined

  try {
    const { error } = await resend.emails.send({
      from: `${fromName} <${FROM_ADDRESS}>`,
      to: toEmail,
      replyTo: agency?.email_reply_to || undefined,
      subject,
      text: body,
    })
    if (error) {
      status = 'failed'
      errorMessage = error.message
    }
  } catch (err) {
    status = 'failed'
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  const { error: logError } = await supabase.from('emails_sent').insert({
    lead_id: leadId,
    sent_by: sentBy,
    subject,
    body,
    status,
  })
  if (logError) console.error('Failed to log email_sent:', logError.message)

  if (status === 'sent') {
    const { error: contactError } = await supabase.from('contacts').insert({
      lead_id: leadId,
      user_id: sentBy,
      type: 'email',
      title: `Email enviado: ${subject}`,
      description: body,
    })
    if (contactError) console.error('Failed to log contact:', contactError.message)
  }

  return { status, error: errorMessage }
}
