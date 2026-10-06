import { resend } from '@/lib/resend'
import { signUnsubscribeToken } from '@/lib/release-notes/token'
import { renderCampaignEmail, type CampaignContent } from './email'
import type { Recipient } from './audience'

const FROM = `FormaCR <${process.env.EMAIL_FROM ?? 'onboarding@resend.dev'}>`
const BATCH_SIZE = 100

export async function sendCampaign(content: CampaignContent, recipients: Recipient[], baseUrl: string) {
  let sent = 0
  let failed = 0

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE)
    const payload = chunk.map(r => {
      const url = `${baseUrl}/api/release-notes/unsubscribe?u=${r.id}&t=${signUnsubscribeToken(r.id)}`
      const { subject, html, text } = renderCampaignEmail(content, url)
      return { from: FROM, to: r.email, subject, html, text, headers: { 'List-Unsubscribe': `<${url}>` } }
    })

    try {
      const { error } = await resend.batch.send(payload)
      if (error) {
        console.error('campaign batch failed:', error.message)
        failed += chunk.length
      } else {
        sent += chunk.length
      }
    } catch (err) {
      console.error('campaign batch threw:', err)
      failed += chunk.length
    }
  }

  return { sent, failed }
}

// Envio de teste: só para um endereço, com prefixo [TESTE] e sem link de cancelar.
export async function sendCampaignTest(content: CampaignContent, to: string): Promise<boolean> {
  const { subject, html, text } = renderCampaignEmail(content, null)
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject: `[TESTE] ${subject}`, html, text })
    if (error) console.error('campaign test failed:', error.message)
    return !error
  } catch (err) {
    console.error('campaign test threw:', err)
    return false
  }
}
