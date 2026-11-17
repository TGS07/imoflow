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
  const [customOpen, setCustomOpen] = useState(false)
  const [customDate, setCustomDate] = useState('')
  const [callTime, setCallTime] = useState('10:00')

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
    setCustomOpen(false)
    // next_call_due leva a hora (no fuso do browser) para a entrada no calendário.
    const due = date ? new Date(`${date}T${callTime || '10:00'}`).toISOString() : null
    patch({ next_call_at: date, next_call_due: due })
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div className="section-label">Ligar daqui a…</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-2xs)', color: 'var(--muted)' }}>
                às
                <input className="input" type="time" value={callTime} onChange={e => setCallTime(e.target.value)} style={{ width: 92, padding: '4px 6px' }} aria-label="Hora da chamada" />
              </label>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {NEXT_CALL_PRESETS.map(n => (
                <button key={n} type="button" className="chip" onClick={() => setNextCall(dateInDays(n))}>{n} dia{n > 1 ? 's' : ''}</button>
              ))}
              <button
                type="button"
                className={`chip${customOpen ? ' active' : ''}`}
                onClick={() => { setCustomOpen(o => !o); setCustomDate(nextCallAt ?? dateInDays(0)) }}
              >📅 Personalizado</button>
            </div>
            {customOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  className="input"
                  type="date"
                  min={dateInDays(0)}
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!customDate}
                  onClick={() => setNextCall(customDate)}
                >
                  {customDate ? `Agendar para ${new Date(customDate + 'T00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' })} às ${callTime || '10:00'}` : 'Escolhe um dia'}
                </button>
              </div>
            )}
            {nextCallAt && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNextCall(null)}>Remover próxima chamada</button>
            )}
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)', lineHeight: 1.4 }}>Fica logo no calendário. No dia recebes uma notificação e o card na pipeline começa a piscar.</div>
          </div>
        )}
      </div>
    </div>
  )
}
