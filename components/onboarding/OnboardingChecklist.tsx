'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
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
    <Card
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        padding: 'var(--space-5)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="font-display" style={{ fontSize: 'var(--fs-lg)', marginBottom: 'var(--space-3)' }}>
          Completa a configuração da tua agência
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {pending.map(item => (
            <Link
              key={item.key}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--fs-sm)',
                color: 'var(--gold)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              {item.label} →
            </Link>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={dismissing}
        aria-label="Fechar"
        className="btn btn-ghost btn-sm"
        style={{ flexShrink: 0, padding: 6 }}
      >
        <Icon name="close" size={14} />
      </button>
    </Card>
  )
}
