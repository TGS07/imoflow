'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type EmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  created_at: string
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/email-templates')
      .then(r => {
        if (!r.ok) throw new Error('Erro ao carregar templates')
        return r.json()
      })
      .then(d => { setTemplates(d); setLoading(false) })
      .catch(() => { setError('Erro ao carregar templates.'); setLoading(false) })
  }, [])

  async function deleteTemplate(id: string) {
    if (!confirm('Eliminar este template? Esta acção não pode ser desfeita.')) return
    setDeleting(id)
    const res = await fetch(`/api/email-templates/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 404) {
      setTemplates(prev => prev.filter(t => t.id !== id))
    }
    setDeleting(null)
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Templates de Email</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Templates reutilizáveis para envio de emails a leads.</p>
        </div>
        <Link
          href="/settings/templates/new"
          style={{ background: 'var(--gold)', color: '#0D0D0F', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
        >
          + Novo template
        </Link>
      </div>

      {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>A carregar...</p>
      ) : templates.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum template criado ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {templates.map(template => (
            <div key={template.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>{template.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {template.subject}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Link
                  href={`/settings/templates/${template.id}`}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--muted)', textDecoration: 'none' }}
                >
                  Editar
                </Link>
                <button
                  onClick={() => deleteTemplate(template.id)}
                  disabled={deleting === template.id}
                  style={{ background: 'none', border: '1px solid #EF4444', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#EF4444', cursor: 'pointer', opacity: deleting === template.id ? 0.5 : 1 }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
