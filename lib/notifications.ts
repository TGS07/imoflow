import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend'
import { isTelegramConfigured, sendTelegramMessage } from '@/lib/telegram/send'
import { webpush } from '@/lib/web-push'

export type NotificationType =
  | 'new_lead'
  | 'task_due'
  | 'lead_stage_changed'
  | 'email_received'
  | 'automation_rule_triggered'
  | 'special_date'

interface CreateNotificationParams {
  userId: string
  agencyId: string
  type: NotificationType
  title: string
  body: string
  link?: string
}

export async function createNotification(params: CreateNotificationParams, client?: SupabaseClient): Promise<{ id: string } | null> {
  const { userId, agencyId, type, title, body, link } = params
  const supabase = client ?? await createClient()

  // 1. Inserir notificação
  const { data: notification, error: insertError } = await supabase
    .from('notifications')
    .insert({ user_id: userId, agency_id: agencyId, type, title, body, link })
    .select('id')
    .single()

  if (insertError || !notification) {
    console.error('Failed to insert notification:', insertError?.message)
    return null
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

  // 3. Buscar dados do utilizador para email + Telegram
  const { data: userRow } = await supabase
    .from('users')
    .select('name, email_notifications, telegram_chat_id')
    .eq('id', userId)
    .single()

  // 3a. Telegram (não bloqueia o envio de email nem é bloqueado por ele)
  if (userRow?.telegram_chat_id && isTelegramConfigured()) {
    try {
      await sendTelegramMessage(
        userRow.telegram_chat_id,
        [`[ImoFlow] ${title}`, '', body, link ? `\nhttps://app.imoflow.pt${link}` : ''].join('\n')
      )
    } catch (err) {
      console.error('Failed to send Telegram notification:', err)
    }
  }

  // 3b. Web Push (only for new_lead and task_due)
  if (type === 'new_lead' || type === 'task_due') {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (subs && subs.length > 0) {
      const payload = JSON.stringify({
        title,
        body,
        link,
        icon: '/icon-192.png',
      })

      await Promise.allSettled(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
          } catch (err: any) {
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            }
            console.error('Push send failed:', err?.statusCode ?? err)
          }
        })
      )
    }
  }

  if (!userRow?.email_notifications) return { id: notification.id }

  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  const toEmail = authUser?.user?.email
  if (!toEmail) return { id: notification.id }

  try {
    await resend.emails.send({
      from: 'ImoFlow <onboarding@resend.dev>',
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

  return { id: notification.id }
}
