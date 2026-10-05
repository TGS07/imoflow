import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTransactionalEmail } from '@/lib/email/transactional'
import { renderTrialEnding, renderTrialEnded } from '@/lib/email/transactional-templates'

const DAY_MS = 24 * 60 * 60 * 1000
const ENDING_WINDOW_DAYS = 2
// Evita avisar trials que expiraram há muito tempo (ex.: antes deste cron existir).
const ENDED_MAX_AGE_DAYS = 7

type Agency = { id: string; name: string; email: string | null; trial_ends_at: string }
type Column = 'trial_ending_email_sent_at' | 'trial_ended_email_sent_at'

// Chamado diariamente via Vercel Cron (GET). Avisa 2 dias antes do fim do trial e
// quando termina. Usa o service client: em cron não há sessão e o RLS bloquearia.
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  const base = () =>
    supabase
      .from('agencies')
      .select('id, name, email, trial_ends_at')
      .eq('plan', 'trial')
      .is('stripe_subscription_id', null)

  const [ending, ended] = await Promise.all([
    base()
      .is('trial_ending_email_sent_at', null)
      .gt('trial_ends_at', nowIso)
      .lte('trial_ends_at', new Date(now + ENDING_WINDOW_DAYS * DAY_MS).toISOString()),
    base()
      .is('trial_ended_email_sent_at', null)
      .lte('trial_ends_at', nowIso)
      .gt('trial_ends_at', new Date(now - ENDED_MAX_AGE_DAYS * DAY_MS).toISOString()),
  ])

  if (ending.error || ended.error) {
    const message = ending.error?.message ?? ended.error?.message
    console.error('Cron trial-reminders: falha ao ler agências:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // Reserva a marca antes de enviar (evita duplicados se duas execuções se sobrepuserem)
  // e repõe-na se o envio falhar, para a próxima execução tentar outra vez.
  async function remind(
    agency: Agency,
    column: Column,
    render: (name: string) => { subject: string; html: string; text: string }
  ): Promise<boolean> {
    const { data: claimed } = await supabase
      .from('agencies')
      .update({ [column]: new Date().toISOString() })
      .eq('id', agency.id)
      .is(column, null)
      .select('id')
    if (!claimed?.length) return false

    const { data: admins } = await supabase
      .from('users')
      .select('name, email')
      .eq('agency_id', agency.id)
      .eq('role', 'admin')

    const recipients = new Map<string, string>()
    for (const a of admins ?? []) if (a.email) recipients.set(a.email, a.name ?? '')
    if (recipients.size === 0 && agency.email) recipients.set(agency.email, '')

    let delivered = false
    for (const [to, name] of recipients) {
      if (await sendTransactionalEmail({ to, ...render(name) })) delivered = true
    }

    if (!delivered) {
      await supabase.from('agencies').update({ [column]: null }).eq('id', agency.id)
    }
    return delivered
  }

  let endingSent = 0
  for (const agency of ending.data ?? []) {
    const daysLeft = Math.max(1, Math.ceil((new Date(agency.trial_ends_at).getTime() - now) / DAY_MS))
    const ok = await remind(agency, 'trial_ending_email_sent_at', name =>
      renderTrialEnding({ name, agencyName: agency.name, trialEndsAt: agency.trial_ends_at, daysLeft })
    )
    if (ok) endingSent++
  }

  let endedSent = 0
  for (const agency of ended.data ?? []) {
    const ok = await remind(agency, 'trial_ended_email_sent_at', name =>
      renderTrialEnded({ name, agencyName: agency.name })
    )
    if (ok) endedSent++
  }

  return NextResponse.json({ endingSent, endedSent })
}
