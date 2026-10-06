'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'

type OnboardingResponse = {
  onboarding_completed: boolean
  onboarding_state: Record<string, unknown> | null
  has_pipeline: boolean
  has_contact: boolean
  has_team_member: boolean
}

type PendingItem = {
  key: string
  label: string
  href: string
}

export function OnboardingChecklist() {
  const [data, setData] = useState<OnboardingResponse | null>(null)
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/onboarding')
      .then(r => (r.ok ? r.json() : null))
      .then((d: OnboardingResponse | null) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null
  if (!data.onboarding_completed) return null

  const state = data.onboarding_state ?? {}
  if (state.dismissed) return null

  const pipelineDone = Boolean(state.pipeline) || data.has_pipeline
  const contactDone = Boolean(state.contact) || data.has_contact
  const teamDone = Boolean(state.team) || data.has_team_member

  const pending: PendingItem[] = []
  if (!pipelineDone) pending.push({ key: 'pipeline', label: 'Pipeline não configurado', href: '/settings/pipeline' })
  if (!contactDone) pending.push({ key: 'contact', label: 'Ainda sem contactos', href: '/people' })
  if (!teamDone) pending.push({ key: 'team', label: 'Equipa por convidar', href: '/settings/team/new' })

  if (pending.length === 0) return null

  async function handleDismiss() {
    setDismissing(true)
    try {
      await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_state: { dismissed: true } }),
      })
      setData(prev => (prev ? { ...prev, onboarding_state: { ...(prev.onboarding_state ?? {}), dismissed: true } } : prev))
    } catch {
      setDismissing(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-4)',
        padding: 'var(--space-4) var(--space-5)',
        borderRadius: 'var(--radius)',
        background: 'var(--gold-glow)',
        border: '1px solid rgba(176,125,46,0.3)',
        marginBottom: 'var(--space-6)',
        position: 'relative',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#0D0D0F', flexShrink: 0, marginTop: 2,
      }}>
        <Icon name="sparkle" size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Completa a configuração da tua agência
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pending.map(item => (
            <Link
              key={item.key}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--gold)',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              <Icon name="arrow-right" size={12} />
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={dismissing}
        aria-label="Fechar"
        className="icon-btn-sm"
        style={{ flexShrink: 0 }}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}
