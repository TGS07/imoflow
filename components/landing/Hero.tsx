import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'

export function Hero() {
  return (
    <section
      style={{
        position: 'relative',
        padding: '96px 24px 80px',
        background:
          'radial-gradient(ellipse 80% 60% at 50% -15%, rgba(176,125,46,0.10), transparent 70%), var(--bg)',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 24 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            fontSize: 'var(--fs-xs)',
            color: 'var(--gold-dim)',
            fontWeight: 600,
          }}
        >
          <Icon name="sparkle" size={14} />
          Feito para agências imobiliárias portuguesas
        </div>

        <h1
          className="font-display"
          style={{
            fontSize: 'clamp(32px, 5vw, 56px)',
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            maxWidth: 820,
            margin: 0,
          }}
        >
          O CRM imobiliário feito para{' '}
          <span
            style={{
              background: 'linear-gradient(120deg, #B07D2E, #C9A84C)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            agências portuguesas
          </span>
        </h1>

        <p
          style={{
            fontSize: 'var(--fs-md)',
            color: 'var(--muted)',
            maxWidth: 620,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Gere leads, imóveis, negócios e equipa num único lugar. Pipeline visual,
          automações e integração com portais como o Idealista — tudo pensado para
          o mercado imobiliário nacional.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
          <Link href="/signup" className="btn btn-primary btn-lg">
            Criar conta grátis
          </Link>
          <Link href="/login" className="btn btn-ghost btn-lg">
            Entrar
          </Link>
        </div>

        {/* Placeholder visual imitando a UI do produto */}
        <div
          style={{
            marginTop: 48,
            width: '100%',
            maxWidth: 880,
            borderRadius: 20,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: '0 24px 60px rgba(60,44,18,0.12), 0 6px 16px rgba(60,44,18,0.05)',
            overflow: 'hidden',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--item-bg)',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#DC2626', opacity: 0.5 }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#C9A84C', opacity: 0.5 }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#059669', opacity: 0.5 }} />
            <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)', marginLeft: 8 }}>imoflow.pt/pipeline</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: 24 }}>
            {['Novo Contacto', 'Visita Marcada', 'Proposta Enviada'].map((col) => (
              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {col}
                </span>
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    style={{
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      padding: '10px 12px',
                      height: 46,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
