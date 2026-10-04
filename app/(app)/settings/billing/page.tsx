'use client'
import { useState, useEffect } from 'react'
import { HelpButton } from '@/components/help/HelpButton'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'

type UsageRow = {
  resource: string
  current: number
  limit: number
  allowed: boolean
}

type UsageResponse = {
  plan: string
  rawPlan: string
  planName: string
  trialEndsAt: string | null
  trialDaysRemaining: number | null
  features: string[]
  usage: UsageRow[]
}

const RESOURCE_LABELS: Record<string, string> = {
  leads: 'Leads',
  people: 'Contactos',
  properties: 'Imóveis',
  members: 'Membros da equipa',
  automations: 'Automações',
}

type PlanOption = {
  id: string
  name: string
  price: string
  description: string
}

const PAID_PLANS: PlanOption[] = [
  { id: 'starter', name: 'Starter', price: '49€/mês', description: '25 leads, 1 utilizador' },
  { id: 'essential', name: 'Essencial', price: '89€/mês', description: 'Ilimitado, 5 utilizadores, automações' },
  { id: 'pro', name: 'Pro', price: '149€/mês', description: 'Tudo ilimitado, 10 utilizadores, portal, IA' },
]

export default function BillingSettingsPage() {
  const [usage, setUsage] = useState<UsageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    fetch('/api/billing/usage')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: UsageResponse) => setUsage(d))
      .catch(() => setLoadError('Erro ao carregar dados de faturação.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleUpgrade(planId: string) {
    setActionLoading(planId)
    setActionError('')
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setActionError(data.error ?? 'Não foi possível iniciar o checkout.')
        setActionLoading(null)
      }
    } catch {
      setActionError('Erro de rede ao contactar o Stripe.')
      setActionLoading(null)
    }
  }

  async function handleManage() {
    setActionLoading('manage')
    setActionError('')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setActionError(data.error ?? 'Não foi possível abrir o portal de faturação.')
        setActionLoading(null)
      }
    } catch {
      setActionError('Erro de rede ao contactar o Stripe.')
      setActionLoading(null)
    }
  }

  const isPaid = usage?.plan === 'starter' || usage?.plan === 'essential' || usage?.plan === 'pro'
  const isTrial = usage?.rawPlan === 'trial'
  const isExpiredTrial = usage?.rawPlan === 'trial' && usage?.plan === 'free'

  return (
    <div className="page-enter page-pad" style={{ padding: '32px 40px', maxWidth: 700 }}>
      <h1 className="font-display" style={{ fontSize: 24, color: 'var(--text)', marginBottom: 6 }}>
        Faturação <HelpButton section="billing" />
      </h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>
        Plano atual, utilização e gestão da subscrição.
      </p>

      {loading ? (
        <div className="skeleton" style={{ height: 220 }} />
      ) : loadError ? (
        <div className="card" style={{ padding: 24, fontSize: 13, color: 'var(--red)' }}>{loadError}</div>
      ) : usage ? (
        <>
          {/* Current plan card */}
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: isPaid ? 'linear-gradient(135deg, var(--gold), var(--gold-dim))' : isTrial ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'var(--surface)',
                  border: (isPaid || isTrial) ? 'none' : '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: (isPaid || isTrial) ? '#fff' : 'var(--muted)',
                }}>
                  <Icon name="sparkle" size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                    {isTrial && !isExpiredTrial ? 'Trial Essencial' : `Plano ${usage.planName}`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {isExpiredTrial
                      ? 'O seu trial expirou. Escolha um plano para continuar.'
                      : isTrial
                        ? `${usage.trialDaysRemaining} dia${usage.trialDaysRemaining !== 1 ? 's' : ''} restante${usage.trialDaysRemaining !== 1 ? 's' : ''} do trial`
                        : isPaid
                          ? 'Subscrição ativa.'
                          : 'Funcionalidades limitadas.'}
                  </div>
                </div>
              </div>
              <span className={`badge ${isPaid ? 'badge-gold' : isTrial && !isExpiredTrial ? 'badge-blue' : 'badge-gray'}`}>
                {isTrial && !isExpiredTrial ? 'Trial' : usage.planName}
              </span>
            </div>

            {/* Trial countdown bar */}
            {isTrial && !isExpiredTrial && usage.trialDaysRemaining !== null && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius)',
                background: usage.trialDaysRemaining <= 2 ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
                border: `1px solid ${usage.trialDaysRemaining <= 2 ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <Icon name="clock" size={16} style={{ color: usage.trialDaysRemaining <= 2 ? 'var(--red)' : '#3b82f6' }} />
                <span style={{ fontSize: 13, color: 'var(--text)' }}>
                  {usage.trialDaysRemaining <= 2
                    ? `O seu trial expira em ${usage.trialDaysRemaining} dia${usage.trialDaysRemaining !== 1 ? 's' : ''}! Escolha um plano para não perder os seus dados.`
                    : `Trial ativo — ${usage.trialDaysRemaining} dias restantes. Escolha um plano a qualquer momento.`
                  }
                </span>
              </div>
            )}

            {/* Usage bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label className="label">Utilização</label>
              {usage.usage.map((row) => {
                const label = RESOURCE_LABELS[row.resource] ?? row.resource
                const finite = Number.isFinite(row.limit)
                const pct = finite && row.limit > 0 ? Math.min(100, Math.round((row.current / row.limit) * 100)) : 0
                const nearLimit = finite && pct >= 80
                return (
                  <div key={row.resource}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text)', marginBottom: 6 }}>
                      <span>{label}</span>
                      <span style={{ color: nearLimit ? 'var(--red)' : 'var(--muted)' }}>
                        {row.current} / {finite ? row.limit : '∞'}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: finite ? `${pct}%` : '100%',
                        borderRadius: 999,
                        background: nearLimit ? 'var(--red)' : 'var(--gold)',
                        opacity: finite ? 1 : 0.25,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {actionError && <div style={{ fontSize: 12, color: 'var(--red)' }}>{actionError}</div>}

            {isPaid && (
              <div style={{ paddingTop: 4 }}>
                <Button onClick={handleManage} loading={actionLoading === 'manage'} variant="soft">
                  Gerir subscrição
                </Button>
              </div>
            )}
          </div>

          {/* Plan selection — show when not on a paid plan */}
          {!isPaid && (
            <div style={{ marginTop: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Escolha o seu plano</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {PAID_PLANS.map((plan) => {
                  const isRecommended = plan.id === 'essential'
                  return (
                    <div
                      key={plan.id}
                      className="card"
                      style={{
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        position: 'relative',
                        border: isRecommended ? '1px solid var(--gold)' : undefined,
                      }}
                    >
                      {isRecommended && (
                        <span style={{
                          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                          background: 'var(--gold-gradient)', color: '#fff',
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                          padding: '3px 10px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap',
                        }}>
                          Recomendado
                        </span>
                      )}
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{plan.name}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{plan.price}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{plan.description}</div>
                      </div>
                      <Button
                        onClick={() => handleUpgrade(plan.id)}
                        loading={actionLoading === plan.id}
                        variant={isRecommended ? 'primary' : 'soft'}
                        style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
                      >
                        Subscrever
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
