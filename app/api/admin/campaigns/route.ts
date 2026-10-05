import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AUDIENCES, countAudiences, filterAudience, loadRecipients, type Audience } from '@/lib/campaigns/audience'
import { sendCampaign, sendCampaignTest } from '@/lib/campaigns/send'

export const maxDuration = 300

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!user?.email && user.email === process.env.SUPER_ADMIN_EMAIL
}

export async function GET() {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const [recipients, history] = await Promise.all([
    loadRecipients(),
    supabase
      .from('campaigns')
      .select('id, subject, audience, status, recipient_count, sent_count, failed_count, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])
  return NextResponse.json({ counts: countAudiences(recipients), history: history.data ?? [] })
}

export async function POST(request: Request) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const subject = typeof b?.subject === 'string' ? b.subject.trim() : ''
  const body = typeof b?.body === 'string' ? b.body.trim() : ''
  const ctaLabel = typeof b?.ctaLabel === 'string' ? b.ctaLabel.trim() : ''
  const ctaUrl = typeof b?.ctaUrl === 'string' ? b.ctaUrl.trim() : ''
  const audience = b?.audience as Audience
  const test = b?.test === true

  if (!subject || subject.length > 150) return NextResponse.json({ error: 'Assunto obrigatório (máx. 150 caracteres).' }, { status: 400 })
  if (!body || body.length > 10000) return NextResponse.json({ error: 'Texto obrigatório (máx. 10000 caracteres).' }, { status: 400 })
  if (!AUDIENCES.includes(audience)) return NextResponse.json({ error: 'Audiência inválida.' }, { status: 400 })
  if (!!ctaLabel !== !!ctaUrl) return NextResponse.json({ error: 'O botão precisa de texto e de link.' }, { status: 400 })
  if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) return NextResponse.json({ error: 'O link do botão tem de começar por http:// ou https://.' }, { status: 400 })

  const content = { subject, body, ctaLabel: ctaLabel || null, ctaUrl: ctaUrl || null }

  if (test) {
    const to = process.env.SUPER_ADMIN_EMAIL!
    const ok = await sendCampaignTest(content, to)
    return NextResponse.json(ok ? { ok: true, to } : { error: 'Falha ao enviar o teste.' }, { status: ok ? 200 : 502 })
  }

  const supabase = createServiceClient()

  // Proteção contra duplo clique / reenvio: a mesma campanha nos últimos 10 minutos.
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: dup } = await supabase
    .from('campaigns')
    .select('id')
    .eq('subject', subject)
    .eq('body', body)
    .gte('created_at', since)
    .limit(1)
  if (dup?.length) return NextResponse.json({ error: 'Esta campanha já foi enviada há poucos minutos.' }, { status: 409 })

  const recipients = filterAudience(await loadRecipients(), audience)
  if (recipients.length === 0) return NextResponse.json({ error: 'Não há destinatários nesta audiência.' }, { status: 400 })

  const { data: row, error: insertError } = await supabase
    .from('campaigns')
    .insert({ subject, body, cta_label: content.ctaLabel, cta_url: content.ctaUrl, audience, recipient_count: recipients.length })
    .select('id')
    .single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const baseUrl = process.env.APP_URL ?? new URL(request.url).origin
  const { sent, failed } = await sendCampaign(content, recipients, baseUrl)
  const status = failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial'

  await supabase
    .from('campaigns')
    .update({ status, sent_count: sent, failed_count: failed, sent_at: new Date().toISOString() })
    .eq('id', row.id)

  return NextResponse.json({ status, sent, failed, total: recipients.length })
}
