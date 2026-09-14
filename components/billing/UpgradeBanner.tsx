'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'

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
  leads: 'leads',
  people: 'contactos',
  properties: 'imóveis',
  members: 'membros da equipa',
  automations: 'automações',
}

const THRESHOLD = 0.8

/**
 * Banner que avisa quando a agency está a aproximar-se (>=80%) de algum
 * limite do plano Free. Não mostra nada em plano Pro (limites ilimitados
 * ou muito folgados) nem enquanto os dados de uso ainda não chegaram.
 */
export function UpgradeBanner() {
  const [usage, setUsage] = useState<UsageResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/billing/usage')
      .then(r => (r.ok ? r.json() : null))
      .then((d: UsageResponse | null) => {
        if (!cancelled) setUsage(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!usage) return null

  const nearLimit = usage.usage.find(
    (u) => Number.isFinite(u.limit) && u.limit > 0 && u.current / u.limit >= THRESHOLD
  )

  if (!nearLimit) return null

  const label = RESOURCE_LABELS[nearLimit.resource] ?? nearLimit.resource

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        padding: 'var(--space-4) var(--space-5)',
        borderRadius: 'var(--radius)',
        background: 'var(--gold-glow)',
        border: '1px solid rgba(176,125,46,0.3)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: 'var(--gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0D0D0F',
            flexShrink: 0,
          }}
        >
          <Icon name="zap" size={15} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)' }}>
          Está a chegar ao limite de <strong>{label}</strong> ({nearLimit.current}/{nearLimit.limit}).
          Upgrade para Pro para continuar sem restrições.
        </div>
      </div>
      <Link href="/settings/billing" className="btn btn-primary btn-sm" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
        Ver planos
      </Link>
    </div>
  )
}
