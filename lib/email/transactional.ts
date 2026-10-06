import { resend } from '@/lib/resend'

const FROM = `FormaCR <${process.env.EMAIL_FROM ?? 'onboarding@resend.dev'}>`

// Emails transacionais (boas-vindas, confirmação de compra). Nunca lança: uma falha
// de email não pode partir o registo nem o webhook do Stripe.
export async function sendTransactionalEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({ from: FROM, ...params })
    if (error) {
      console.error('[transactional email] falhou:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[transactional email] erro:', err)
    return false
  }
}
