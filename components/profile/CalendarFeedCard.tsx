'use client'
import { useEffect, useState } from 'react'

export function CalendarFeedCard() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/users/me/calendar-token')
      .then(r => r.ok ? r.json() : null)
      .then((d: { calendar_token: string } | null) => setToken(d?.calendar_token ?? null))
      .finally(() => setLoading(false))
  }, [])

  const url = token && typeof window !== 'undefined' ? `${window.location.origin}/api/calendar/${token}.ics` : ''

  async function copy() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerate() {
    if (!confirm('Regenerar o link invalida o link atual — quem o tiver guardado deixa de receber atualizações. Continuar?')) return
    setLoading(true)
    const res = await fetch('/api/users/me/calendar-token', { method: 'POST' })
    const d = await res.json()
    setToken(d.calendar_token)
    setLoading(false)
  }

  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
      <div>
        <h3 className="font-display" style={{ fontSize: 15, marginBottom: 4 }}>O meu calendário</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          Subscreve este link no Notion Calendar, Google Calendar ou Apple Calendar (opção &quot;Subscrever calendário&quot; / &quot;From URL&quot;) para veres, num calendário externo, as notificações dos contactos e leads em que ligaste a sincronização.
        </p>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 36 }} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input readOnly value={url} onFocus={e => e.target.select()} style={{ flex: 1, minWidth: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)' }} />
            <button type="button" onClick={copy} className="btn btn-ghost btn-sm">{copied ? 'Copiado ✓' : 'Copiar link'}</button>
          </div>
          <button type="button" onClick={regenerate} className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start' }}>Regenerar link</button>
        </>
      )}
    </div>
  )
}
