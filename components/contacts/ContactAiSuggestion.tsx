'use client'
import { useState } from 'react'
import { dateInDays } from '@/lib/contacts/engagement'

type Suggestion = {
  action: string
  reason: string
  urgency: string
  channel: string | null
  when: string | null
  tips: string[]
  next_call_in_days: number | null
}

const CHANNEL_LABELS: Record<string, string> = { chamada: '📞 Chamada', whatsapp: '💬 WhatsApp', email: '✉️ Email', visita: '🏠 Visita', reuniao: '🤝 Reunião' }

export function ContactAiSuggestion({ personId, onChanged }: { personId: string; onChanged?: () => void }) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [scheduled, setScheduled] = useState(false)

  async function fetchSuggestion() {
    setLoading(true)
    setFailed(false)
    setScheduled(false)
    setSuggestion(null)
    try {
      const res = await fetch('/api/ai/suggest-contact-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId }),
      })
      if (res.ok) setSuggestion(await res.json())
      else setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  async function scheduleNextCall(days: number) {
    const res = await fetch(`/api/people/${personId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ next_call_at: dateInDays(days) }),
    })
    if (res.ok) { setScheduled(true); onChanged?.() }
  }

  const urgencyStyle = (u: string) => ({
    background: u === 'alta' ? '#FEE2E2' : u === 'media' ? '#FEF3C7' : '#F0FDF4',
    color: u === 'alta' ? '#DC2626' : u === 'media' ? '#D97706' : '#16A34A',
  })

  return (
    <div className="card" style={{ overflow: 'hidden', border: '1px solid rgba(176,125,46,0.3)', background: 'linear-gradient(135deg, rgba(176,125,46,0.06), var(--card) 55%)' }}>
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, color: 'var(--gold)' }}>✦</span>
          <span className="font-display" style={{ fontSize: 14, color: 'var(--gold)' }}>Sugestão IA</span>
        </div>
        <button
          onClick={fetchSuggestion}
          disabled={loading}
          className="btn btn-soft btn-sm"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'A analisar…' : suggestion ? '↺ Atualizar' : 'Analisar contacto'}
        </button>
      </div>
      {suggestion && (
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 3, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', ...urgencyStyle(suggestion.urgency) }}>
              {suggestion.urgency}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{suggestion.action}</span>
          </div>
          {(suggestion.channel || suggestion.when) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {suggestion.channel && <span className="chip" style={{ fontSize: 11, cursor: 'default' }}>{CHANNEL_LABELS[suggestion.channel] ?? suggestion.channel}</span>}
              {suggestion.when && <span className="chip" style={{ fontSize: 11, cursor: 'default' }}>🕒 {suggestion.when}</span>}
            </div>
          )}
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, margin: 0 }}>{suggestion.reason}</p>
          {suggestion.tips.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {suggestion.tips.map((t, i) => <li key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{t}</li>)}
            </ul>
          )}
          {suggestion.next_call_in_days != null && (
            <div>
              <button type="button" className="btn btn-ghost btn-sm" disabled={scheduled} onClick={() => scheduleNextCall(suggestion.next_call_in_days!)}>
                {scheduled ? '✓ Próxima chamada agendada' : `📞 Agendar próxima chamada (${suggestion.next_call_in_days === 0 ? 'hoje' : `daqui a ${suggestion.next_call_in_days} dia${suggestion.next_call_in_days > 1 ? 's' : ''}`})`}
              </button>
            </div>
          )}
        </div>
      )}
      {!suggestion && !loading && (
        <p style={{ fontSize: 12, color: failed ? 'var(--red)' : 'var(--muted)', padding: '0 20px 16px', margin: 0 }}>
          {failed
            ? 'Não foi possível gerar a sugestão. Tenta de novo.'
            : 'Analisa temperatura, características, historial de chamadas e imóveis para sugerir o próximo passo. Quanto mais preencheres o contacto, melhores as dicas.'}
        </p>
      )}
    </div>
  )
}
