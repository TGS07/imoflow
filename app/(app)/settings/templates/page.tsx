'use client'
import { useState, useEffect } from 'react'
import { HelpButton } from '@/components/help/HelpButton'
import Link from 'next/link'
import { WhatsAppTemplate } from '@/types'
import { Icon } from '@/components/ui/Icon'
import { AVAILABLE_VARIABLES } from '@/lib/email/variables'

type EmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  created_at: string
}

type Tab = 'email' | 'whatsapp'

export default function TemplatesPage() {
  const [tab, setTab] = useState<Tab>('email')
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waModal, setWaModal] = useState<{ open: boolean; template: WhatsAppTemplate | null }>({ open: false, template: null })

  useEffect(() => {
    Promise.all([
      fetch('/api/email-templates').then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/whatsapp-templates').then(r => r.ok ? r.json() : Promise.reject()),
    ])
      .then(([emails, was]) => { setTemplates(emails); setWaTemplates(was) })
      .catch(() => setError('Erro ao carregar templates.'))
      .finally(() => setLoading(false))
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

  async function deleteWaTemplate(id: string) {
    if (!confirm('Eliminar este template? Esta acção não pode ser desfeita.')) return
    setDeleting(id)
    const res = await fetch(`/api/whatsapp-templates/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 404) {
      setWaTemplates(prev => prev.filter(t => t.id !== id))
    }
    setDeleting(null)
  }

  function handleWaSaved(saved: WhatsAppTemplate) {
    setWaTemplates(prev => {
      const exists = prev.some(t => t.id === saved.id)
      return exists ? prev.map(t => t.id === saved.id ? saved : t) : [...prev, saved]
    })
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    background: active ? 'var(--gold-glow)' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--muted)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    transition: 'all 0.2s',
  })

  return (
    <div className="page-enter" style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 24, color: 'var(--text)', marginBottom: 4 }}>Templates <HelpButton section="templates" /></h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Mensagens reutilizáveis para email e WhatsApp. Usa variáveis: {AVAILABLE_VARIABLES.map(v => `{{${v}}}`).join(' ')}
          </p>
        </div>
        {tab === 'email' ? (
          <Link href="/settings/templates/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            <Icon name="plus" size={15} /> Novo template
          </Link>
        ) : (
          <button className="btn btn-primary" onClick={() => setWaModal({ open: true, template: null })}>
            <Icon name="plus" size={15} /> Novo template
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <button style={tabStyle(tab === 'email')} onClick={() => setTab('email')}>
          <Icon name="mail" size={15} /> Email ({templates.length})
        </button>
        <button style={tabStyle(tab === 'whatsapp')} onClick={() => setTab('whatsapp')}>
          <Icon name="whatsapp" size={15} /> WhatsApp ({waTemplates.length})
        </button>
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 64 }} />)}
        </div>
      ) : tab === 'email' ? (
        templates.length === 0 ? (
          <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum template de email criado ainda.</p>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {templates.map(template => (
              <div key={template.id} className="card card-hover" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>{template.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {template.subject}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Link href={`/settings/templates/${template.id}`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
                    Editar
                  </Link>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    disabled={deleting === template.id}
                    className="btn btn-danger btn-sm"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        waTemplates.length === 0 ? (
          <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ color: 'var(--whatsapp)', marginBottom: 12 }}><Icon name="whatsapp" size={32} /></div>
            <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>Nenhum template de WhatsApp ainda</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
              Cria respostas rápidas — o consultor responde a uma lead em segundos com a mensagem já escrita.
            </p>
            <button className="btn btn-primary" onClick={() => setWaModal({ open: true, template: null })}>
              <Icon name="plus" size={15} /> Criar primeiro template
            </button>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {waTemplates.map(template => (
              <div key={template.id} className="card card-hover" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>{template.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {template.body}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setWaModal({ open: true, template })}>
                    Editar
                  </button>
                  <button
                    onClick={() => deleteWaTemplate(template.id)}
                    disabled={deleting === template.id}
                    className="btn btn-danger btn-sm"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {waModal.open && (
        <WaTemplateModal
          template={waModal.template}
          onClose={() => setWaModal({ open: false, template: null })}
          onSaved={handleWaSaved}
        />
      )}
    </div>
  )
}

function WaTemplateModal({ template, onClose, onSaved }: {
  template: WhatsAppTemplate | null
  onClose: () => void
  onSaved: (t: WhatsAppTemplate) => void
}) {
  const [name, setName] = useState(template?.name ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !body.trim()) { setError('Preenche o nome e a mensagem.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(template ? `/api/whatsapp-templates/${template.id}` : '/api/whatsapp-templates', {
        method: template ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), body: body.trim() }),
      })
      if (res.ok) {
        onSaved(await res.json())
        onClose()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Erro ao guardar.')
      }
    } catch {
      setError('Erro de rede ao guardar.')
    } finally {
      setSaving(false)
    }
  }

  function insertVariable(variable: string) {
    setBody(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}{{${variable}}}`)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 18 }}>
            {template ? 'Editar template WhatsApp' : 'Novo template WhatsApp'}
          </div>
          <button onClick={onClose} className="icon-btn"><Icon name="close" size={16} /></button>
        </div>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Nome</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Primeira resposta" />
          </div>
          <div>
            <label className="label">Mensagem</label>
            <textarea
              className="input"
              style={{ minHeight: 130 }}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={'Olá {{nome}}! Obrigado pelo seu contacto. Sou o {{agente}} da {{agencia}} e vou acompanhá-lo na sua procura. Em que posso ajudar?'}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {AVAILABLE_VARIABLES.map(v => (
                <button key={v} type="button" className="badge badge-gold" style={{ cursor: 'pointer', border: 'none' }} onClick={() => insertVariable(v)}>
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
