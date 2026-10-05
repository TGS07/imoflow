function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderReleaseEmail(items: string[], unsubscribeUrl: string | null) {
  const subject = 'Novidades na FormaCR'

  const lis = items.map(i => `<li style="margin:0 0 8px">${escapeHtml(i)}</li>`).join('')
  const footer = unsubscribeUrl
    ? `<p style="color:#888;font-size:12px;margin-top:24px">Não queres receber estes avisos? <a href="${escapeHtml(unsubscribeUrl)}" style="color:#888">Cancelar subscrição</a>.</p>`
    : ''

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">` +
    `<h2 style="margin:0 0 12px">Novidades na FormaCR</h2>` +
    `<p style="margin:0 0 12px">Acabámos de lançar melhorias na plataforma:</p>` +
    `<ul style="padding-left:20px;margin:0">${lis}</ul>` +
    footer +
    `</div>`

  const text =
    `Novidades na FormaCR\n\nAcabámos de lançar melhorias na plataforma:\n\n` +
    items.map(i => `- ${i}`).join('\n') +
    (unsubscribeUrl ? `\n\nCancelar subscrição: ${unsubscribeUrl}` : '')

  return { subject, html, text }
}
