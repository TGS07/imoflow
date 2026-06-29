'use client'
import { useState, useEffect } from 'react'
import { WhatsAppTemplate } from '@/types'
import { Icon } from '@/components/ui/Icon'
import { fillVariables } from '@/lib/email/variables'
import { buildWaLink } from '@/lib/whatsapp/utils'

type Props = {
  leadId: string
  leadName: string
  leadPhone: string
  leadEmail: string | null
  agentName?: string
  onClose: () => void
  onSent: () => void
}

export function WhatsAppModal({ leadId, leadName, leadPhone, leadEmail, agentName, onClose, onSent }: Props) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [opening, setOpening] = useState(false)
  const [aiDrafting, setAiDrafting] = useState(false)

  useEffect(() => {
    fetch('/api/whatsapp-templates').then(r => r.ok ? r.json() : []).then(setTemplates).catch(() => {})
    fetch('/api/agency')
      .then(r => r.ok ? r.json() : {})
      .then((d: { name?: string }) => setAgencyName(d.name ?? ''))
      .catch(() => {})
  }, [])

  const vars = {
    nome: leadName,
    email: leadEmail,
    telefone: leadPhone,
    agente: agentName,
    agencia: agencyName,
  }

  function handleTemplateSelect(templateId: string) {
    setSelectedId(templateId)
    if (!templateId) return
    const tpl = templates.find(t => t.id === templateId)
    if (tpl) setMessage(fillVariables(tpl.body, vars))
  }

  async function handleAiDraft() {
    setAiDrafting(true)
    try {
      const res = await fetch('/api/ai/draft-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      })
      if (res.ok) {
        const { draft } = await res.json() as { draft: string }
        setMessage(draft)
        setSelectedId('')
      }
    } catch {
      // silently fail
    } finally {
      setAiDrafting(false)
    }
  }

  async function handleOpen() {
    if (!message.trim()) return
    setOpening(true)
    window.open(buildWaLink(leadPhone, message), '_blank', 'noopener')

    // Registar no histórico como atividade concluída
    try {
      await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          type: 'whatsapp',
          title: 'WhatsApp enviado',
          description: message,
          completed: true,
        }),
      })
    } catch {
      // histórico falhou mas a mensagem seguiu — não bloquear
    }
    setOpening(false)
    onSent()
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--whatsapp)' }}><Icon name="whatsapp" size={20} /></span>
            <div className="font-display" style={{ fontSize: 18 }}>WhatsApp para {leadName}</div>
          </div>
          <button onClick={onClose} className="icon-btn"><Icon name="close" size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {templates.length > 0 && (
            <div>
              <label className="label">Resposta rápida</label>
              <select className="input" value={selectedId} onChange={e => handleTemplateSelect(e.target.value)}>
                <option value="">— Escolher template —</option>
                {templates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="label" style={{ margin: 0 }}>Mensagem</label>
              <button
                type="button"
                onClick={handleAiDraft}
                disabled={aiDrafting}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 10px',
                  borderRadius: 6, border: '1px solid rgba(176,125,46,0.3)', background: 'rgba(176,125,46,0.07)',
                  color: 'var(--gold)', cursor: aiDrafting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
                  opacity: aiDrafting ? 0.6 : 1,
                }}
              >
                <span>✦</span>
                {aiDrafting ? 'A redigir...' : 'Sugerir com IA'}
              </button>
            </div>
            <textarea
              className="input"
              style={{ minHeight: 130 }}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Escreve a mensagem ou escolhe um template acima…"
            />
          </div>

          <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
            Abre o WhatsApp com a mensagem pronta para {leadPhone} — só falta carregar em enviar.
            A interação fica registada no histórico da lead.
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
            <button
              type="button"
              onClick={handleOpen}
              disabled={opening || !message.trim()}
              className="btn btn-whatsapp"
              style={{ flex: 1 }}
            >
              <Icon name="whatsapp" size={15} /> Abrir WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
