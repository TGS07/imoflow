'use client'
import { useState, useEffect } from 'react'

type Props = {
  stageId: string
  stageName: string
  onClose: () => void
  onSaved?: () => void
}

// Mini-editor dos avisos de uma etapa: "ao entrar" e "parado há X dias".
// Lê/escreve via /api/pipeline-stages/[id]/notifications (regras de automação).
export function StageNotificationsModal({ stageId, stageName, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onEnter, setOnEnter] = useState(false)
  const [staleEnabled, setStaleEnabled] = useState(false)
  const [staleDays, setStaleDays] = useState('7')

  useEffect(() => {
    fetch(`/api/pipeline-stages/${stageId}/notifications`)
      .then(r => r.ok ? r.json() : { on_enter: false, stale_days: null })
      .then((d: { on_enter: boolean; stale_days: number | null }) => {
        setOnEnter(d.on_enter)
        setStaleEnabled(d.stale_days != null)
        if (d.stale_days != null) setStaleDays(String(d.stale_days))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [stageId])

  async function save() {
    const days = Number(staleDays)
    if (staleEnabled && (!Number.isInteger(days) || days < 1)) {
      setError('Indica um número de dias válido (≥ 1).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/pipeline-stages/${stageId}/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on_enter: onEnter, stale_days: staleEnabled ? days : null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string }).error ?? 'Erro ao guardar avisos.')
        return
      }
      onSaved?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(400px, 92vw)', padding: 24 }}>
        <div className="font-display" style={{ fontSize: 16, marginBottom: 4 }}>🔔 Notificações da etapa</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>{stageName}</div>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0' }}>A carregar…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={onEnter} onChange={e => setOnEnter(e.target.checked)} />
              Avisar quando um contacto entra nesta etapa
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', flexWrap: 'wrap' }}>
              <input type="checkbox" checked={staleEnabled} onChange={e => setStaleEnabled(e.target.checked)} />
              Avisar quando um contacto está parado há
              <input
                className="input"
                type="number"
                min={1}
                value={staleDays}
                disabled={!staleEnabled}
                onChange={e => setStaleDays(e.target.value)}
                style={{ width: 64, textAlign: 'center', opacity: staleEnabled ? 1 : 0.5 }}
              />
              dias nesta etapa
            </label>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Os avisos vão para o responsável do contacto e aparecem também em Definições → Automações.
            </div>
            {error && <div style={{ fontSize: 12, color: '#DC2626' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
              <button type="button" onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'A guardar…' : 'Guardar'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
