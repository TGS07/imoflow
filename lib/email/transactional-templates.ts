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

export function renderWelcome(p: { name: string; agencyName: string }) {
  const subject = 'Bem-vindo à FormaCR'
  const { html, text } = layout(
    `Bem-vindo, ${firstName(p.name)}!`,
    [
      `A conta da agência <strong>${esc(p.agencyName)}</strong> está criada e já podes começar a usar a FormaCR.`,
    ],
    { label: 'Abrir a FormaCR', url: `${APP_URL}/dashboard` }
  )
  return { subject, html, text }
}
