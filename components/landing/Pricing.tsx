import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'

type PlanCard = {
  name: string
  price: string
  priceSuffix?: string
  perUser: string
  description: string
  limitsLabel: string
  limits: string[]
  features: string[]
  disabledFeatures?: string[]
  cta: string
  highlight?: boolean
  badge?: string
}

const PLANS: PlanCard[] = [
  {
    name: 'Starter',
    price: '49€',
    priceSuffix: '/mês',
    perUser: '49€/utilizador',
    description: 'Para consultores independentes.',
    limitsLabel: 'Limites',
    limits: [
      '25 leads ativos',
      '50 contactos',
      '15 imóveis',
      '1 utilizador',
    ],
    features: [
      'Pipeline e dashboard',
      'Fichas de imóveis',
      'Contactos e atividades',
    ],
    disabledFeatures: [
      'Automações',
      'Relatórios',
      'Templates email',
      'Recomendações IA',
      'Portal cliente',
      'Idealista e WhatsApp',
    ],
    cta: 'Começar',
  },
  {
    name: 'Essencial',
    price: '89€',
    priceSuffix: '/mês',
    perUser: '17,80€/utilizador',
    description: 'Para agências que querem crescer com processo.',
    limitsLabel: 'Limites',
    limits: [
      'Leads ilimitados',
      'Contactos ilimitados',
      'Imóveis ilimitados',
      'Até 5 utilizadores',
    ],
    features: [
      'Tudo do Starter',
      'Automações (até 10 regras)',
      'Relatórios completos',
      'Templates de email',
      'Formulários ilimitados',
      'Recomendações IA',
    ],
    disabledFeatures: [
      'Portal cliente',
      'Idealista e WhatsApp',
    ],
    cta: 'Experimentar 7 dias grátis',
    highlight: true,
    badge: 'Mais popular · Trial 7 dias',
  },
  {
    name: 'Pro',
    price: '149€',
    priceSuffix: '/mês',
    perUser: '14,90€/utilizador',
    description: 'Para agências que querem tudo, sem limites.',
    limitsLabel: 'Limites',
    limits: [
      'Tudo ilimitado',
      'Até 10 utilizadores',
    ],
    features: [
      'Tudo do Essencial',
      'Automações ilimitadas',
      'Portal do cliente',
      'Recomendações IA',
      'Integração Idealista',
      'WhatsApp integrado',
      'Suporte prioritário',
      'API access',
    ],
    cta: 'Começar',
  },
]

const PER_USER_DATA = [
  { label: 'Starter', value: '49€', color: 'var(--muted)' },
  { label: 'Essencial', value: '17,80€', color: 'var(--gold)' },
  { label: 'Pro', value: '14,90€', color: '#4ade80' },
]

export function Pricing() {
  return (
    <section id="pricing" style={{ padding: '80px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 56px' }}>
          <span className="section-label" style={{ color: 'var(--gold)' }}>Planos</span>
          <h2 className="font-display" style={{ fontSize: 'var(--fs-3xl)', color: 'var(--text)', margin: '8px 0 12px', letterSpacing: '-0.02em' }}>
            Escolha o plano certo para a sua agência
          </h2>
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
            Comece com 7 dias grátis no plano Essencial. Sem cartão de crédito.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="card"
              style={{
                padding: 28,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                position: 'relative',
                border: plan.highlight ? '1px solid var(--gold)' : undefined,
                boxShadow: plan.highlight ? '0 0 0 1px var(--gold), 0 8px 32px rgba(176,125,46,0.12)' : undefined,
                transform: plan.highlight ? 'scale(1.03)' : undefined,
                zIndex: plan.highlight ? 1 : undefined,
              }}
            >
              {plan.badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--gold-gradient)',
                    color: '#fff',
                    fontSize: 'var(--fs-2xs)',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-pill)',
                    boxShadow: 'var(--gold-gradient-shadow)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ⭐ {plan.badge}
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

              {/* Limits */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>
                  {plan.limitsLabel}
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.limits.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>
                      <span style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }}>
                        <Icon name="check" size={14} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--border)' }} />

              {/* Features */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>
                  Funcionalidades
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>
                      <span style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }}>
                        <Icon name="check" size={14} />
                      </span>
                      {f}
                    </li>
                  ))}
                  {plan.disabledFeatures?.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--muted)', opacity: 0.45, textDecoration: 'line-through' }}>
                      <span style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2, opacity: 0.4 }}>
                        <Icon name="x" size={14} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/signup"
                className={`btn ${plan.highlight ? 'btn-primary' : 'btn-soft'}`}
                style={{ justifyContent: 'center', marginTop: 'auto' }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Per-user price bar */}
        <div
          className="card"
          style={{
            marginTop: 24,
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
            flexWrap: 'wrap',
          }}
        >
          {PER_USER_DATA.map((item, i) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: i < PER_USER_DATA.length - 1 ? 32 : 0 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}<small style={{ fontSize: 11, fontWeight: 400 }}>/utilizador</small></div>
              </div>
              {i < PER_USER_DATA.length - 1 && (
                <span style={{ color: 'var(--muted)', fontSize: 18, opacity: 0.4, marginLeft: 32 }}>→</span>
              )}
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--muted)', opacity: 0.7 }}>
          Quanto maior o plano, menor o custo por membro da equipa
        </p>
      </div>
    </section>
  )
}
