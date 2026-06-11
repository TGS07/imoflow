import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'
import { sendLeadEmail } from '@/lib/email/send'
import { fillVariables } from '@/lib/email/variables'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lead_id, to_email, subject, body } = await request.json()
  if (!lead_id || !to_email || !subject || !body) {
    return NextResponse.json({ error: 'lead_id, to_email, subject e body são obrigatórios' }, { status: 400 })
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('name, email, phone, assigned_to, agency_id')
    .eq('id', lead_id)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead não encontrada' }, { status: 404 })

  const [{ data: profile }, { data: agency }] = await Promise.all([
    supabase.from('users').select('name').eq('id', user.id).single(),
    supabase.from('agencies').select('name').eq('id', lead.agency_id).single(),
  ])

  const vars = {
    nome: lead.name,
    email: lead.email,
    telefone: lead.phone,
    agente: profile?.name,
    agencia: agency?.name,
  }

  const result = await sendLeadEmail({
    supabase,
    leadId: lead_id,
    agencyId: lead.agency_id,
    toEmail: to_email,
    subject: fillVariables(subject, vars),
    body: fillVariables(body, vars),
    sentBy: user.id,
  })

  if (result.status === 'sent' && lead.assigned_to && lead.agency_id) {
    await createNotification({
      userId: lead.assigned_to,
      agencyId: lead.agency_id,
      type: 'email_received',
      title: `Email enviado a ${lead.name}`,
      body: `Foi enviado um email a ${lead.name}: "${subject}"`,
      link: `/leads/${lead_id}`,
    })
  }

  if (result.status === 'failed') {
    return NextResponse.json({ error: 'Erro ao enviar email' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
