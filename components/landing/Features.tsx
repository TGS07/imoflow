import type { IconName } from '@/components/ui/Icon'
import { Icon } from '@/components/ui/Icon'

type Feature = {
  icon: IconName
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: 'pipeline',
    title: 'Pipeline visual',
    description: 'Acompanhe cada negócio por fases, do primeiro contacto ao fecho, num quadro kanban simples de gerir.',
  },
  {
    icon: 'leads',
    title: 'Gestão de leads e contactos',
    description: 'Centralize leads, contactos e histórico de interações num só lugar, sem folhas de cálculo dispersas.',
  },
  {
    icon: 'upload',
    title: 'Upload de fotos e documentos',
    description: 'Anexe fotografias de imóveis, contratos e documentos diretamente às fichas, com armazenamento seguro.',
  },
  {
    icon: 'zap',
    title: 'Automações e notificações',
    description: 'Defina automações para lembretes, follow-ups e notificações, e nunca perca uma oportunidade.',
  },
  {
    icon: 'chart',
    title: 'Relatórios',
    description: 'Dashboards e relatórios com os indicadores que importam: conversão, atividade da equipa e desempenho.',
  },
  {
    icon: 'building',
    title: 'Integração com portais',
    description: 'Publique e sincronize os seus imóveis com portais como o Idealista sem duplicar trabalho manual.',
  },
]

export function Features() {
  return (
    <section style={{ padding: '80px 24px', background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 56px' }}>
          <span className="section-label" style={{ color: 'var(--gold)' }}>Funcionalidades</span>
          <h2 className="font-display" style={{ fontSize: 'var(--fs-3xl)', color: 'var(--text)', margin: '8px 0 12px', letterSpacing: '-0.02em' }}>
            Tudo o que a sua agência precisa
          </h2>
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
            Um único sistema para gerir leads, imóveis, equipa e resultados — sem complicação.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card"
              style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--gold-gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: 'var(--gold-gradient-shadow)',
                }}
              >
                <Icon name={f.icon} size={20} />
              </div>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text)' }}>{f.title}</div>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
