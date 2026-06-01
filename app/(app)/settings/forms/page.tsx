'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { WebForm } from '@/types'

const FIELD_LABELS: Record<string, string> = {
  name: 'Nome', email: 'Email', phone: 'Telefone',
  message: 'Mensagem', zone: 'Zona', typology: 'Tipologia', budget: 'Orçamento',
}

export default function FormsPage() {
  const [forms, setForms] = useState<WebForm[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/forms').then(r => r.json()).then(d => { setForms(d); setLoading(false) })
  }, [])

  async function deleteForm(id: string) {
    if (!confirm('Eliminar este formulário? Esta ação não pode ser desfeita.')) return
    setDeleting(id)
    await fetch(`/api/forms/${id}`, { method: 'DELETE' })
    setForms(prev => prev.filter(f => f.id !== id))
    setDeleting(null)
  }

  function copyLink(id: string) {
    const url = `${window.location.origin}/f/${id}`
    navigator.clipboard.writeText(url)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const badgeStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
    background: active ? '#10B98120' : '#6B728020',
    color: active ? '#10B981' : '#6B7280',
  })

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Formulários Web</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Formulários para capturar leads no seu site via iframe.</p>
        </div>
        <Link
          href="/settings/forms/new"
          style={{ background: 'var(--gold)', color: '#0D0D0F', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
        >
          + Novo formulário
        </Link>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>A carregar...</p>
      ) : forms.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum formulário criado ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {forms.map(form => (
            <div key={form.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{form.name}</span>
                  <span style={badgeStyle(form.is_active)}>{form.is_active ? 'Activo' : 'Inactivo'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Campos: {form.fields.map(f => FIELD_LABELS[f] ?? f).join(', ')}
                </div>
                {form.pipeline_stages && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Stage: {form.pipeline_stages.name}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => copyLink(form.id)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: copied === form.id ? '#10B981' : 'var(--muted)', cursor: 'pointer' }}
                >
                  {copied === form.id ? 'Copiado!' : 'Copiar link'}
                </button>
                <Link
                  href={`/settings/forms/${form.id}`}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--muted)', textDecoration: 'none' }}
                >
                  Editar
                </Link>
                <button
                  onClick={() => deleteForm(form.id)}
                  disabled={deleting === form.id}
                  style={{ background: 'none', border: '1px solid #EF4444', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#EF4444', cursor: 'pointer', opacity: deleting === form.id ? 0.5 : 1 }}
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
