import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend'

export type NotificationType =
  | 'new_lead'
  | 'task_due'
  | 'lead_stage_changed'
  | 'email_received'

interface CreateNotificationParams {
  userId: string
  agencyId: string
  type: NotificationType
  title: string
  body: string
  link?: string
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const { userId, agencyId, type, title, body, link } = params
  const supabase = await createClient()

  // 1. Inserir notificação
  const { error: insertError } = await supabase
    .from('notifications')
    .insert({ user_id: userId, agency_id: agencyId, type, title, body, link })

  if (insertError) {
    console.error('Failed to insert notification:', insertError.message)
    return
  }

  // 2. Apagar as mais antigas se total > 20
  const { data: allIds } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (allIds && allIds.length > 20) {
    const toDelete = allIds.slice(20).map((r) => r.id)
    await supabase
      .from('notifications')
      .delete()
      .in('id', toDelete)
  }

  // 3. Verificar opt-out e enviar email
  const { data: userRow } = await supabase
    .from('users')
    .select('name, email_notifications')
    .eq('id', userId)
    .single()

  if (!userRow?.email_notifications) return

  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  const toEmail = authUser?.user?.email
  if (!toEmail) return

  try {
    await resend.emails.send({
      from: 'ImoFlow <noreply@imoflow.pt>',
      to: toEmail,
      subject: `[ImoFlow] ${title}`,
      text: [
        `Olá ${userRow.name ?? ''},`,
        '',
        body,
        link ? `\nVer detalhes: https://app.imoflow.pt${link}` : '',
        '',
        '---',
        'ImoFlow · Para desactivar notificações por email, vai a Definições > Notificações.',
      ].join('\n'),
    })
  } catch (err) {
    console.error('Failed to send notification email:', err)
  }
}
