'use client'
import { useState, useEffect } from 'react'
import { HelpButton } from '@/components/help/HelpButton'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { PRO_PRICE_DISPLAY } from '@/lib/stripe/plans'

type UsageRow = {
  resource: string
  current: number
  limit: number
  allowed: boolean
}

type UsageResponse = {
  plan: string
  planName: string
  usage: UsageRow[]
}

const RESOURCE_LABELS: Record<string, string> = {
  leads: 'Leads',
  people: 'Contactos',
  properties: 'Imóveis',
  members: 'Membros da equipa',
  automations: 'Automações',
}

export default function BillingSettingsPage() {
  const [usage, setUsage] = useState<UsageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    fetch('/api/billing/usage')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: UsageResponse) => setUsage(d))
      .catch(() => setLoadError('Erro ao carregar dados de faturação.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleUpgrade() {
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setActionError(data.error ?? 'Não foi possível iniciar o checkout. Tenta novamente mais tarde.')
        setActionLoading(false)
      }
    } catch {
      setActionError('Erro de rede ao contactar o Stripe.')
      setActionLoading(false)
    }
  }

  async function handleManage() {
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setActionError(data.error ?? 'Não foi possível abrir o portal de faturação. Tenta novamente mais tarde.')
        setActionLoading(false)
      }
    } catch {
      setActionError('Erro de rede ao contactar o Stripe.')
      setActionLoading(false)
    }
  }

  const isPro = usage?.plan === 'pro'

  return (
    <div className="page-enter page-pad" style={{ padding: '32px 40px', maxWidth: 640 }}>
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
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: isPro ? 'linear-gradient(135deg, var(--gold), var(--gold-dim))' : 'var(--surface)',
                  border: isPro ? 'none' : '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isPro ? '#0D0D0F' : 'var(--muted)',
                }}>
                  <Icon name="sparkle" size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Plano {usage.planName}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {isPro ? 'Acesso completo, sem limites de utilização.' : 'Plano gratuito com limites de utilização.'}
                  </div>
                </div>
              </div>
              <span className={`badge ${isPro ? 'badge-gold' : 'badge-gray'}`}>
                {isPro ? 'Pro' : 'Free'}
              </span>
            </div>

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

            <div style={{ paddingTop: 4, display: 'flex', alignItems: 'center', gap: 14 }}>
              {isPro ? (
                <Button onClick={handleManage} loading={actionLoading} variant="soft">
                  Gerir subscrição
                </Button>
              ) : (
                <>
                  <Button onClick={handleUpgrade} loading={actionLoading} variant="primary">
                    Upgrade para Pro
                  </Button>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{PRO_PRICE_DISPLAY}</span>
                </>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 20, marginTop: 16, background: 'var(--surface)' }}>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>
              <strong style={{ color: 'var(--gold)' }}>Plano Pro — {PRO_PRICE_DISPLAY}:</strong> leads, contactos, imóveis e automações
              ilimitados, até 10 membros de equipa. Gere a tua subscrição (fatura, cartão, cancelamento) a
              qualquer momento através do botão acima.
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
