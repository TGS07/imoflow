'use client'
import { useState } from 'react'

type Props = {
  leadId: string
  leadEmail: string | null
  onClose: () => void
  onSent: () => void
}

export function SendEmailModal({ leadId, leadEmail, onClose, onSent }: Props) {
  const [to, setTo] = useState(leadEmail ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }
  const labelStyle = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 5 }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, to_email: to, subject, body }),
      })
      if (res.ok) { onSent(); onClose() }
      else { const d = await res.json(); setError(d.error ?? 'Erro ao enviar.') }
    } catch {
      setError('Erro de rede ao enviar email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 18 }}>Enviar Email</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={labelStyle}>Para</label><input type="email" style={inputStyle} value={to} onChange={e => setTo(e.target.value)} required /></div>
          <div><label style={labelStyle}>Assunto</label><input style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} required /></div>
          <div>
            <label style={labelStyle}>Mensagem</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 120, lineHeight: 1.6 }} value={body} onChange={e => setBody(e.target.value)} required />
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 11, fontSize: 13, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ flex: 1, background: 'var(--gold)', border: 'none', borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 600, color: '#0D0D0F', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Jost, sans-serif' }}>
              {loading ? 'A enviar...' : '✉ Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
