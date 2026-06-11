'use client'
import { useState, useEffect } from 'react'
import { AutomationRule, AutomationLog } from '@/types'
import { RuleFormModal } from '@/components/automations/RuleFormModal'
import { Icon } from '@/components/ui/Icon'

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: 'Lead criada',
  stage_changed: 'Lead muda de etapa',
  activity_completed: 'Atividade concluída',
  lead_inactive: 'Lead inativa X dias',
  whatsapp_message_received: 'WhatsApp recebido',
}

const ACTION_LABELS: Record<string, string> = {
  create_activity: 'Criar atividade',
  send_notification: 'Notificar consultor',
  move_stage: 'Mover etapa',
  send_email: 'Enviar email automático',
  send_whatsapp: 'Enviar WhatsApp automático',
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, AutomationLog[]>>({})
  const [toggling, setToggling] = useState<string | null>(null)
  const [modalRule, setModalRule] = useState<AutomationRule | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [whatsappConfigured, setWhatsappConfigured] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/automations')
      .then(r => r.ok ? r.json() : [])
      .then((data: AutomationRule[]) => setRules(data))
      .finally(() => setLoading(false))
    fetch('/api/agency')
      .then(r => r.ok ? r.json() : {})
      .then(d => setWhatsappConfigured(Boolean(d.whatsapp_configured)))
      .catch(() => {})
  }, [])

  async function toggleRule(rule: AutomationRule) {
    setToggling(rule.id)
    const res = await fetch(`/api/automations/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    if (res.ok) {
      const updated = await res.json()
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r))
    }
    setToggling(null)
  }

  async function deleteRule(rule: AutomationRule) {
    if (!confirm(`Apagar a regra "${rule.name}"? Esta ação não pode ser anulada.`)) return
    setDeleting(rule.id)
    const res = await fetch(`/api/automations/${rule.id}`, { method: 'DELETE' })
    if (res.ok || res.status === 404) {
      setRules(prev => prev.filter(r => r.id !== rule.id))
    }
    setDeleting(null)
  }

  async function expandRule(ruleId: string) {
    if (expandedId === ruleId) {
      setExpandedId(null)
      return
    }
    setExpandedId(ruleId)
    if (!logs[ruleId]) {
      const res = await fetch(`/api/automations/${ruleId}/logs`)
      if (res.ok) {
        const data = await res.json()
        setLogs(prev => ({ ...prev, [ruleId]: data }))
      }
    }
  }

  function handleSaved(saved: AutomationRule) {
    setRules(prev => {
      const exists = prev.some(r => r.id === saved.id)
      return exists ? prev.map(r => r.id === saved.id ? saved : r) : [...prev, saved]
    })
  }

  return (
    <div className="page-enter" style={{ padding: '32px 40px', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 24, marginBottom: 6, color: 'var(--text)' }}>Automações</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Regras que executam ações automaticamente — emails de follow-up, lembretes, WhatsApp e mais.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setModalRule(null); setShowModal(true) }}>
          <Icon name="plus" size={15} /> Nova regra
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 88 }} />)}
        </div>
      ) : rules.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ color: 'var(--gold)', marginBottom: 12 }}><Icon name="zap" size={32} /></div>
          <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>Ainda não tens regras de automação</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
            Cria a primeira — por exemplo, enviar um email automático quando uma lead fica 7 dias sem resposta.
          </p>
          <button className="btn btn-primary" onClick={() => { setModalRule(null); setShowModal(true) }}>
            <Icon name="plus" size={15} /> Criar primeira regra
          </button>
        </div>
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rules.map(rule => (
            <div key={rule.id} className="card card-hover" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{rule.name}</span>
                    <span className={rule.is_active ? 'badge badge-green' : 'badge badge-gray'}>
                      {rule.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  {rule.description && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>{rule.description}</p>
                  )}
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Quando: <strong style={{ color: 'var(--text)' }}>{TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type}</strong>
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Então: <strong style={{ color: 'var(--text)' }}>{ACTION_LABELS[rule.action_type] ?? rule.action_type}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                  <button onClick={() => expandRule(rule.id)} className="btn btn-ghost btn-sm">
                    {expandedId === rule.id ? 'Fechar' : 'Logs'}
                  </button>
                  <button
                    onClick={() => { setModalRule(rule); setShowModal(true) }}
                    className="icon-btn"
                    title="Editar"
                  >
                    <Icon name="pencil" size={15} />
                  </button>
                  <button
                    onClick={() => deleteRule(rule)}
                    disabled={deleting === rule.id}
                    className="icon-btn"
                    title="Apagar"
                    style={{ color: 'var(--red)' }}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                  <button
                    onClick={() => toggleRule(rule)}
                    disabled={toggling === rule.id}
                    className={rule.is_active ? 'btn btn-danger btn-sm' : 'btn btn-sm'}
                    style={!rule.is_active ? { background: 'rgba(78,204,163,0.13)', color: 'var(--green)' } : undefined}
                  >
                    {rule.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>

              {/* Logs expandidos */}
              {expandedId === rule.id && (
                <div className="divider" style={{ marginTop: 14, paddingTop: 14 }}>
                  <p className="label" style={{ marginBottom: 8 }}>Últimas execuções</p>
                  {!logs[rule.id] ? (
                    <div className="skeleton" style={{ height: 40 }} />
                  ) : logs[rule.id].length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhuma execução registada.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {logs[rule.id].map(log => (
                        <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                          <span style={{ color: log.status === 'success' ? 'var(--green)' : 'var(--red)', fontWeight: 600, minWidth: 14 }}>
                            {log.status === 'success' ? '✓' : '✗'}
                          </span>
                          <span style={{ color: 'var(--text)' }}>
                            {log.leads?.name ?? log.lead_id}
                          </span>
                          {log.status === 'failed' && log.result && typeof log.result.error === 'string' && (
                            <span style={{ color: 'var(--red)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                              {log.result.error}
                            </span>
                          )}
                          <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>
                            {new Date(log.triggered_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RuleFormModal
          rule={modalRule}
          whatsappConfigured={whatsappConfigured}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
