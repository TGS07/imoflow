'use client'
import { useState, useEffect } from 'react'

type EmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
}

type Props = {
  leadId: string
  leadEmail: string | null
  onClose: () => void
  onSent: () => void
  initialSubject?: string
  initialBody?: string
}

export function SendEmailModal({ leadId, leadEmail, onClose, onSent, initialSubject, initialBody }: Props) {
  const [to, setTo] = useState(leadEmail ?? '')
  const [subject, setSubject] = useState(initialSubject ?? '')
  const [body, setBody] = useState(initialBody ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')

  useEffect(() => {
    fetch('/api/email-templates')
      .then(r => r.ok ? r.json() : [])
      .then((data: EmailTemplate[]) => setTemplates(data))
      .catch(() => {})
  }, [])

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplate(templateId)
    if (!templateId) return
    const tpl = templates.find(t => t.id === templateId)
    if (tpl) {
      setSubject(tpl.subject)
      setBody(tpl.body)
    }
  }


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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 18 }}>Enviar Email</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {templates.length > 0 && (
            <div>
              <label className="label">Usar template</label>
              <select
                className="input"
                value={selectedTemplate}
                onChange={e => handleTemplateSelect(e.target.value)}
              >
                <option value="">— Nenhum —</option>
                {templates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}
              </select>
            </div>
          )}
          <div><label className="label">Para</label><input type="email" className="input" value={to} onChange={e => setTo(e.target.value)} required /></div>
          <div><label className="label">Assunto</label><input className="input" value={subject} onChange={e => setSubject(e.target.value)} required /></div>
          <div>
            <label className="label">Mensagem</label>
            <textarea className="input" style={{ minHeight: 120 }} value={body} onChange={e => setBody(e.target.value)} required />
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
              {loading ? 'A enviar...' : '✉ Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
