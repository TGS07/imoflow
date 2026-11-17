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
  const customN = Math.floor(Number(customDays))
  const customValid = customDays !== '' && Number.isFinite(customN) && customN >= 1

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

      <button
        type="button"
        disabled={busy}
        onClick={() => setPickerOpen(o => !o)}
        className={`chip${nextCallAt ? ' active' : ''}`}
        style={due != null && due <= 0 ? { background: 'rgba(220,38,38,0.1)', color: '#DC2626', borderColor: 'rgba(220,38,38,0.4)' } : undefined}
        aria-expanded={pickerOpen}
      >
        📞 {nextCallAt ? `${nextCallLabel(nextCallAt)} · ${new Date(nextCallAt + 'T00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}` : 'Próxima chamada'}
      </button>

      {/* Abre em linha (ocupa a largura toda) em vez de flutuar: assim nunca
          fica cortado pelo cartão/painel onde está. */}
      {pickerOpen && (
        <div style={{ flexBasis: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--item-bg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="section-label">Ligar daqui a…</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {NEXT_CALL_PRESETS.map(n => (
              <button key={n} type="button" className="chip" onClick={() => setNextCall(dateInDays(n))}>{n} dia{n > 1 ? 's' : ''}</button>
            ))}
          </div>
          <form
            onSubmit={e => { e.preventDefault(); if (customValid) setNextCall(dateInDays(customN)) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
          >
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>Outro:</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="ex. 5"
              value={customDays}
              onChange={e => setCustomDays(e.target.value)}
              style={{ width: 80 }}
              aria-label="Número de dias"
            />
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>dias</span>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!customValid}>
              {customValid ? `Agendar (${new Date(dateInDays(customN) + 'T00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' })})` : 'Agendar'}
            </button>
          </form>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)', lineHeight: 1.4 }}>Fica no calendário. No dia recebes uma notificação e o card na pipeline pisca.</div>
            {nextCallAt && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNextCall(null)}>Remover</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
