import { resend } from '@/lib/resend'
import { createServiceClient } from '@/lib/supabase/service'
import { signUnsubscribeToken } from './token'
import { renderReleaseEmail } from './email'

const FROM = `FormaCR <${process.env.EMAIL_FROM ?? 'onboarding@resend.dev'}>`
const BATCH_SIZE = 100

type Recipient = { id: string; email: string }

// Com RELEASE_EMAILS_ENABLED desligada, só o super-admin recebe (modo de teste).
async function getRecipients(): Promise<Recipient[]> {
  const supabase = createServiceClient()
  const query = supabase.from('users').select('id, email').eq('product_updates_opt_out', false)

  if (process.env.RELEASE_EMAILS_ENABLED !== 'true') {
    const admin = process.env.SUPER_ADMIN_EMAIL
    if (!admin) return []
    const { data } = await query.eq('email', admin)
    return data ?? []
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).filter(u => !!u.email)
}

export async function sendReleaseEmails(items: string[], baseUrl: string) {
  const recipients = await getRecipients()
  let sent = 0
  let failed = 0

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE)
    const payload = chunk.map(r => {
      const url = `${baseUrl}/api/release-notes/unsubscribe?u=${r.id}&t=${signUnsubscribeToken(r.id)}`
      const { subject, html, text } = renderReleaseEmail(items, url)
      return {
        from: FROM,
        to: r.email,
        subject,
        html,
        text,
        headers: { 'List-Unsubscribe': `<${url}>` },
      }
    })

    try {
      const { error } = await resend.batch.send(payload)
      if (error) {
        console.error('release-notes batch failed:', error.message)
        failed += chunk.length
      } else {
        sent += chunk.length
      }
    } catch (err) {
      console.error('release-notes batch threw:', err)
      failed += chunk.length
    }
  }

  return { sent, failed, total: recipients.length }
}
