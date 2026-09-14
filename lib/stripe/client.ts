import Stripe from 'stripe'

// Instância singleton do SDK Stripe. A apiVersion usada é a mais recente
// suportada pelo pacote `stripe` instalado (ver node_modules/stripe/cjs/apiVersion.d.ts) —
// não inventar/hardcode uma versão diferente sem confirmar contra o pacote.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-08-26.dahlia',
})
