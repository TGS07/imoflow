'use client'
import { useState } from 'react'

type Suggestion = { action: string; reason: string; urgency: string }

export function ContactAiSuggestion({ personId }: { personId: string }) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchSuggestion() {
    setLoading(true)
    setSuggestion(null)
    try {
      const res = await fetch('/api/ai/suggest-contact-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId }),
      })
      if (res.ok) setSuggestion(await res.json())
    } catch {
      // falha silenciosa
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ overflow: 'hidden', border: '1px solid rgba(176,125,46,0.25)' }}>
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, color: 'var(--gold)' }}>✦</span>
          <span className="font-display" style={{ fontSize: 13, color: 'var(--gold)' }}>Sugestão IA</span>
        </div>
        <button
          onClick={fetchSuggestion}
          disabled={loading}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'A analisar...' : suggestion ? '↺ Atualizar' : 'Analisar contacto'}
        </button>
      </div>
      {suggestion && (
        <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9, padding: '2px 7px', borderRadius: 3, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              background: suggestion.urgency === 'alta' ? '#FEE2E2' : suggestion.urgency === 'media' ? '#FEF3C7' : '#F0FDF4',
              color: suggestion.urgency === 'alta' ? '#DC2626' : suggestion.urgency === 'media' ? '#D97706' : '#16A34A',
            }}>
              {suggestion.urgency}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{suggestion.action}</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>{suggestion.reason}</p>
        </div>
      )}
      {!suggestion && !loading && (
        <p style={{ fontSize: 11, color: 'var(--muted)', padding: '0 18px 14px', margin: 0 }}>
          Clica em &quot;Analisar contacto&quot; para receber uma sugestão personalizada.
        </p>
      )}
    </div>
  )
}
