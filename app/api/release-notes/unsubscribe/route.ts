import { createServiceClient } from '@/lib/supabase/service'
import { verifyUnsubscribeToken } from '@/lib/release-notes/token'

function page(message: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FormaCR</title></head>` +
      `<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#111"><h2>FormaCR</h2><p>${message}</p></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const userId = params.get('u') ?? ''
  const token = params.get('t') ?? ''

  if (!userId || !token || !verifyUnsubscribeToken(userId, token)) {
    return page('Ligação inválida ou expirada.', 400)
  }

  const { error } = await createServiceClient()
    .from('users')
    .update({ product_updates_opt_out: true })
    .eq('id', userId)

  if (error) return page('Não foi possível cancelar agora. Tenta mais tarde.', 500)
  return page('Subscrição cancelada. Já não vais receber avisos de novidades.')
}
