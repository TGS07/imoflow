'use client'
import { useState } from 'react'
import type { ContactTemperature } from '@/types'
import { TEMPERATURES, NEXT_CALL_PRESETS, dateInDays, daysUntil, nextCallLabel } from '@/lib/contacts/engagement'

type Props = {
  personId: string
  temperature: ContactTemperature | null
  nextCallAt: string | null
  onChanged?: () => void
  compact?: boolean
}

// Topo da ficha do contacto e da lead: temperatura (frio/fresco/morno/quente) e
// próxima chamada (daqui a X dias → notificação + card a pulsar no dia).
export function ContactEngagementBar({ personId, temperature, nextCallAt, onChanged, compact }: Props) {
  const [busy, setBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [customDays, setCustomDays] = useState('')

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch(`/api/people/${personId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) onChanged?.()
    } finally { setBusy(false) }
  }

  function setNextCall(date: string | null) {
    setPickerOpen(false)
    setCustomDays('')
    patch({ next_call_at: date })
  }

  const due = nextCallAt ? daysUntil(nextCallAt) : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', opacity: busy ? 0.6 : 1 }}>
      <div className="temp-switch" role="group" aria-label="Temperatura do contacto">
        {TEMPERATURES.map(t => {
          const active = temperature === t.key
          return (
            <button
              key={t.key}
              type="button"
              disabled={busy}
              onClick={() => patch({ temperature: active ? null : t.key })}
              className={`temp-btn${active ? ' active' : ''}`}
              style={active ? { background: `${t.color}1A`, color: t.color, borderColor: `${t.color}66` } : undefined}
              title={active ? 'Clica para limpar' : `Marcar como ${t.label.toLowerCase()}`}
            >
              <span aria-hidden>{t.emoji}</span>{!compact && <span>{t.label}</span>}
            </button>
          )
        })}
      </div>

      <div style={{ position: 'relative' }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => setPickerOpen(o => !o)}
          className={`chip${nextCallAt ? ' active' : ''}`}
          style={due != null && due <= 0 ? { background: 'rgba(220,38,38,0.1)', color: '#DC2626', borderColor: 'rgba(220,38,38,0.4)' } : undefined}
        >
          📞 {nextCallAt ? `${nextCallLabel(nextCallAt)} · ${new Date(nextCallAt + 'T00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}` : 'Próxima chamada'}
        </button>
        {pickerOpen && (
          <div className="card" style={{ position: 'absolute', top: '110%', left: 0, zIndex: 40, width: 250, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'var(--shadow-md)' }}>
            <div className="section-label">Ligar daqui a…</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {NEXT_CALL_PRESETS.map(n => (
                <button key={n} type="button" className="chip" onClick={() => setNextCall(dateInDays(n))}>{n} dia{n > 1 ? 's' : ''}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="input" type="number" min={0} placeholder="outro (dias)" value={customDays} onChange={e => setCustomDays(e.target.value)} style={{ flex: 1 }} />
              <button type="button" className="btn btn-soft btn-sm" disabled={customDays === '' || Number(customDays) < 0} onClick={() => setNextCall(dateInDays(Number(customDays)))}>OK</button>
            </div>
            <input className="input" type="date" value={nextCallAt ?? ''} onChange={e => e.target.value && setNextCall(e.target.value)} />
            {nextCallAt && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNextCall(null)}>Remover próxima chamada</button>
            )}
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)', lineHeight: 1.4 }}>No dia recebes uma notificação e o card na pipeline começa a piscar.</div>
          </div>
        )}
      </div>
    </div>
  )
}
