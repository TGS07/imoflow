'use client'
import { useState, useEffect } from 'react'
import { AutomationRule, AutomationLog } from '@/types'

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: 'Lead criada',
  stage_changed: 'Stage mudou',
  activity_completed: 'Atividade concluída',
  lead_inactive: 'Lead inativa',
}

const ACTION_LABELS: Record<string, string> = {
  create_activity: 'Criar atividade',
  send_notification: 'Enviar notificação',
  move_stage: 'Mover stage',
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, AutomationLog[]>>({})
  const [toggling, setToggling] = useState<string | null>(null)

  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }
  const badgeStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    background: active ? '#10B98120' : '#6B728020',
    color: active ? '#10B981' : '#6B7280',
  })

  useEffect(() => {
    fetch('/api/automations').then(r => r.json()).then(setRules)
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

  return (
    <div style={{ padding: '32px 40px', maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Automações</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
        Regras que executam ações automaticamente em resposta a eventos no CRM.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rules.map(rule => (
          <div key={rule.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{rule.name}</span>
                  <span style={badgeStyle(rule.is_active)}>{rule.is_active ? 'Activa' : 'Inactiva'}</span>
                </div>
                {rule.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{rule.description}</p>
                )}
                <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Trigger: <strong>{TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type}</strong>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Ação: <strong>{ACTION_LABELS[rule.action_type] ?? rule.action_type}</strong>
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => expandRule(rule.id)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {expandedId === rule.id ? 'Fechar' : 'Logs'}
                </button>
                <button
                  onClick={() => toggleRule(rule)}
                  disabled={toggling === rule.id}
                  style={{
                    background: rule.is_active ? '#EF444420' : '#10B98120',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: rule.is_active ? '#EF4444' : '#10B981',
                    cursor: 'pointer',
                    opacity: toggling === rule.id ? 0.6 : 1,
                  }}
                >
                  {rule.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>

            {/* Logs expandidos */}
            {expandedId === rule.id && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Últimas execuções
                </p>
                {!logs[rule.id] ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>A carregar...</p>
                ) : logs[rule.id].length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma execução registada.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {logs[rule.id].map(log => (
                      <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                        <span style={{ color: log.status === 'success' ? '#10B981' : '#EF4444', fontWeight: 600, minWidth: 14 }}>
                          {log.status === 'success' ? '✓' : '✗'}
                        </span>
                        <span style={{ color: 'var(--text)' }}>
                          {(log as AutomationLog & { leads?: { name: string } }).leads?.name ?? log.lead_id}
                        </span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
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
    </div>
  )
}
