import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lead_id, to_email, subject, body } = await request.json()
  if (!lead_id || !to_email || !subject || !body) {
    return NextResponse.json({ error: 'lead_id, to_email, subject e body são obrigatórios' }, { status: 400 })
  }

  let status: 'sent' | 'failed' = 'sent'
  try {
    await resend.emails.send({
      from: 'ImoFlow <noreply@imoflow.pt>',
      to: to_email,
      subject,
      text: body,
    })
  } catch {
    status = 'failed'
  }

  // Registar em emails_sent
  const { error: logError } = await supabase.from('emails_sent').insert({
    lead_id, sent_by: user.id, subject, body, status
  })
  if (logError) console.error('Failed to log email_sent:', logError.message)

  // Registar no histórico de contactos
  if (status === 'sent') {
    const { error: contactError } = await supabase.from('contacts').insert({
      lead_id,
      user_id: user.id,
      type: 'email',
      title: `Email enviado: ${subject}`,
      description: body,
    })
    if (contactError) console.error('Failed to log contact:', contactError.message)

    // Buscar nome da lead e dados do agente para a notificação
    const { data: lead } = await supabase
      .from('leads')
      .select('name, assigned_to, agency_id')
      .eq('id', lead_id)
      .single()

    if (lead?.assigned_to && lead?.agency_id) {
      await createNotification({
        userId: lead.assigned_to,
        agencyId: lead.agency_id,
        type: 'email_received',
        title: `Email recebido de ${lead.name}`,
        body: `Recebeste um email de ${lead.name}: "${subject}"`,
        link: `/leads/${lead_id}`,
      })
    }
  }

  if (status === 'failed') {
    return NextResponse.json({ error: 'Erro ao enviar email' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
