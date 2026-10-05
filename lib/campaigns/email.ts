function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type CampaignContent = {
  subject: string
  body: string
  ctaLabel?: string | null
  ctaUrl?: string | null
}

export function renderCampaignEmail(c: CampaignContent, unsubscribeUrl: string | null) {
  const paragraphs = c.body
    .trim()
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)

  const cta = c.ctaLabel && c.ctaUrl ? { label: c.ctaLabel, url: c.ctaUrl } : null

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">` +
    `<h2 style="margin:0 0 16px">${esc(c.subject)}</h2>` +
    paragraphs.map(p => `<p style="margin:0 0 12px;line-height:1.5">${esc(p).replace(/\n/g, '<br>')}</p>`).join('') +
    (cta
      ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${esc(cta.label)}</a></p>`
      : '') +
    (unsubscribeUrl
      ? `<p style="color:#888;font-size:12px;margin-top:24px">Não queres receber estes emails? <a href="${esc(unsubscribeUrl)}" style="color:#888">Cancelar subscrição</a>.</p>`
      : '') +
    `</div>`

  const text =
    [c.subject, ...paragraphs, cta ? `${cta.label}: ${cta.url}` : null, unsubscribeUrl ? `Cancelar subscrição: ${unsubscribeUrl}` : null]
      .filter(Boolean)
      .join('\n\n')

  return { subject: c.subject, html, text }
}
