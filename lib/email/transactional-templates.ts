const APP_URL = process.env.APP_URL ?? 'https://imoflow.vercel.app'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'olá'
}

function layout(title: string, paragraphs: string[], cta: { label: string; url: string }) {
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">` +
    `<h2 style="margin:0 0 16px">${esc(title)}</h2>` +
    paragraphs.map(p => `<p style="margin:0 0 12px;line-height:1.5">${p}</p>`).join('') +
    `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${esc(cta.label)}</a></p>` +
    `<p style="color:#888;font-size:12px;margin:0">FormaCR</p>` +
    `</div>`
  const text = [title, ...paragraphs.map(p => p.replace(/<[^>]+>/g, '')), `${cta.label}: ${cta.url}`].join('\n\n')
  return { html, text }
}

function formatDatePt(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Lisbon',
  })
}

export function renderTrialStarted(p: { name: string; agencyName: string; trialEndsAt: string }) {
  const subject = 'Bem-vindo à FormaCR — o teu trial de 7 dias começou'
  const { html, text } = layout(
    `Bem-vindo, ${firstName(p.name)}!`,
    [
      `A conta da agência <strong>${esc(p.agencyName)}</strong> está criada e tens acesso completo à FormaCR até <strong>${esc(formatDatePt(p.trialEndsAt))}</strong>.`,
      'Não pediste cartão e não vais ser cobrado. Quando o trial acabar, escolhes o plano que fizer sentido.',
    ],
    { label: 'Abrir a FormaCR', url: `${APP_URL}/dashboard` }
  )
  return { subject, html, text }
}

export function renderPlanConfirmed(p: { name: string; planName: string; priceDisplay: string | null }) {
  const subject = `Subscrição confirmada — plano ${p.planName}`
  const price = p.priceDisplay ? ` (${esc(p.priceDisplay)})` : ''
  const { html, text } = layout(
    'Subscrição confirmada',
    [
      `Obrigado, ${esc(firstName(p.name))}! O plano <strong>${esc(p.planName)}</strong>${price} está ativo na tua agência.`,
      'Podes ver os dados da subscrição, as faturas e alterar ou cancelar o plano a qualquer momento nas definições de faturação.',
    ],
    { label: 'Gerir subscrição', url: `${APP_URL}/settings/billing` }
  )
  return { subject, html, text }
}
