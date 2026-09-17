import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'

type Plan = {
  name: string
  price: string
  priceSuffix?: string
  description: string
  features: string[]
  cta: string
  highlight?: boolean
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: 'Grátis',
    description: 'Para experimentar o ImoFlow sem custos.',
    features: [
      'Até 5 leads ativos',
      '1 utilizador',
      'Até 3 imóveis',
      'Pipeline e fichas de imóveis',
    ],
    cta: 'Criar conta grátis',
  },
  {
    name: 'Pro',
    price: '90€',
    priceSuffix: '/mês',
    description: 'Para agências que querem escalar sem limites.',
    features: [
      'Leads, contactos e imóveis ilimitados',
      'Até 10 utilizadores',
      'Automações avançadas',
      'Integração com portais (Idealista)',
      'Relatórios completos',
    ],
    cta: 'Criar conta grátis',
    highlight: true,
  },
]

export function Pricing() {
  return (
    <section style={{ padding: '80px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 56px' }}>
          <span className="section-label" style={{ color: 'var(--gold)' }}>Planos</span>
          <h2 className="font-display" style={{ fontSize: 'var(--fs-3xl)', color: 'var(--text)', margin: '8px 0 12px', letterSpacing: '-0.02em' }}>
            Escolha o plano certo para a sua agência
          </h2>
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
            Comece grátis e evolua quando precisar. Sem compromissos.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="card"
              style={{
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                position: 'relative',
                border: plan.highlight ? '1px solid var(--gold)' : undefined,
                boxShadow: plan.highlight ? 'var(--shadow-lg)' : undefined,
              }}
            >
              {plan.highlight && (
                <span
                  style={{
                    position: 'absolute',
                    top: -12,
                    right: 24,
                    background: 'var(--gold-gradient)',
                    color: '#fff',
                    fontSize: 'var(--fs-2xs)',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-pill)',
                    boxShadow: 'var(--gold-gradient-shadow)',
                  }}
                >
                  Recomendado
                </span>
              )}

              <div>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)' }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                  <span className="font-display" style={{ fontSize: 'var(--fs-2xl)', color: 'var(--text)' }}>{plan.price}</span>
                  {plan.priceSuffix && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>{plan.priceSuffix}</span>}
                </div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>{plan.description}</p>
              </div>

              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>
                    <span style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 2 }}>
                      <Icon name="check" size={14} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link href="/signup" className={`btn ${plan.highlight ? 'btn-primary' : 'btn-soft'}`} style={{ justifyContent: 'center', marginTop: 'auto' }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
