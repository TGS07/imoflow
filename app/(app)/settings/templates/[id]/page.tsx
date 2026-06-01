'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/email-templates')
      .then(r => r.json())
      .then((templates: Array<{ id: string; name: string; subject: string; body: string }>) => {
        const tpl = templates.find(t => t.id === id)
        if (tpl) {
          setName(tpl.name)
          setSubject(tpl.subject)
          setBody(tpl.body)
        }
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar template.'); setLoading(false) })
  }, [id])

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7,
    padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none',
    fontFamily: 'Jost, sans-serif', width: '100%', boxSizing: 'border-box',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setError('Todos os campos são obrigatórios.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/email-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), subject: subject.trim(), body: body.trim() }),
      })
      if (res.ok) {
        router.push('/settings/templates')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Erro ao actualizar template.')
      }
    } catch {
      setError('Erro de rede. Verifica a tua ligação.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: '32px 40px', fontSize: 13, color: 'var(--muted)' }}>A carregar...</div>

  return (
    <div style={{ padding: '32px 40px', maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 28 }}>Editar template</h1>

      {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label htmlFor="tpl-name" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome *</label>
          <input id="tpl-name" type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label htmlFor="tpl-subject" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Assunto *</label>
          <input id="tpl-subject" type="text" value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label htmlFor="tpl-body" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Corpo *</label>
          <textarea
            id="tpl-body"
            value={body}
            onChange={e => setBody(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 160, lineHeight: 1.6 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <button
            type="submit"
            disabled={saving}
            style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Jost, sans-serif' }}
          >
            {saving ? 'A guardar...' : 'Guardar alterações'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/settings/templates')}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
