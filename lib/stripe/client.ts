import Stripe from 'stripe'

// A apiVersion usada é a mais recente suportada pelo pacote `stripe` instalado
// (ver node_modules/stripe/cjs/apiVersion.d.ts) — não inventar/hardcode uma
// versão diferente sem confirmar contra o pacote.
let cached: Stripe | null = null

// Inicialização preguiçosa: `new Stripe(undefined, ...)` lança de imediato, e
// instanciar ao nível do módulo faria o Next.js falhar a recolha de dados das
// páginas (e logo o build) sempre que STRIPE_SECRET_KEY não estiver definida —
// só cria o cliente quando uma rota de billing é de facto invocada.
export function getStripe(): Stripe {
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-08-26.dahlia',
    })
  }
  return cached
}
