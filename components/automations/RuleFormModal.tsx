'use client'
import { useState, useEffect } from 'react'
import { AutomationRule, AutomationTriggerType, AutomationActionType, PipelineStage, WhatsAppTemplate } from '@/types'
import { Icon } from '@/components/ui/Icon'

type EmailTemplate = { id: string; name: string }

type Props = {
  rule: AutomationRule | null
  whatsappConfigured: boolean
  onClose: () => void
  onSaved: (rule: AutomationRule) => void
}

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string }[] = [
  { value: 'lead_created', label: 'Lead criada' },
  { value: 'stage_changed', label: 'Lead muda de etapa' },
  { value: 'activity_completed', label: 'Atividade concluída' },
  { value: 'lead_inactive', label: 'Lead sem atividade há X dias' },
  { value: 'whatsapp_message_received', label: 'Mensagem WhatsApp recebida (Business API)' },
]

const ACTION_OPTIONS: { value: AutomationActionType; label: string }[] = [
  { value: 'send_email', label: 'Enviar email automático (template)' },
  { value: 'send_whatsapp', label: 'Enviar WhatsApp automático (Business API)' },
  { value: 'create_activity', label: 'Criar atividade' },
  { value: 'send_notification', label: 'Notificar o consultor' },
  { value: 'move_stage', label: 'Mover lead para etapa' },
]

const ACTIVITY_TYPES = ['tarefa', 'chamada', 'visita', 'email', 'reuniao'] as const

export function RuleFormModal({ rule, whatsappConfigured, onClose, onSaved }: Props) {
  const [name, setName] = useState(rule?.name ?? '')
  const [description, setDescription] = useState(rule?.description ?? '')
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(rule?.trigger_type ?? 'lead_created')
  const [actionType, setActionType] = useState<AutomationActionType>(rule?.action_type ?? 'send_email')

  // Trigger config
  const tConfig = (rule?.trigger_config ?? {}) as Record<string, unknown>
  const [toStageId, setToStageId] = useState(String(tConfig.to_stage_id ?? ''))
  const [inactiveDays, setInactiveDays] = useState(String(tConfig.inactive_days ?? '7'))

  // Action config
  const aConfig = (rule?.action_config ?? {}) as Record<string, unknown>
  const [emailTemplateId, setEmailTemplateId] = useState(
    rule?.action_type === 'send_email' ? String(aConfig.template_id ?? '') : ''
  )
  const [waTemplateId, setWaTemplateId] = useState(
    rule?.action_type === 'send_whatsapp' ? String(aConfig.template_id ?? '') : ''
  )
  const [activityType, setActivityType] = useState(String(aConfig.activity_type ?? 'tarefa'))
  const [activityTitle, setActivityTitle] = useState(String(aConfig.title ?? ''))
  const [dueDays, setDueDays] = useState(String(aConfig.due_days ?? '1'))
  const [message, setMessage] = useState(String(aConfig.message ?? ''))
  const [moveStageId, setMoveStageId] = useState(
    rule?.action_type === 'move_stage' ? String(aConfig.to_stage_id ?? '') : ''
  )

  const [stages, setStages] = useState<PipelineStage[]>([])
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplate[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/pipeline-stages').then(r => r.ok ? r.json() : []).then(setStages).catch(() => {})
    fetch('/api/email-templates').then(r => r.ok ? r.json() : []).then(setEmailTemplates).catch(() => {})
    fetch('/api/whatsapp-templates').then(r => r.ok ? r.json() : []).then(setWaTemplates).catch(() => {})
  }, [])

  function buildPayload() {
    const trigger_config: Record<string, unknown> = {}
    if (triggerType === 'stage_changed' && toStageId) trigger_config.to_stage_id = toStageId
    if (triggerType === 'lead_inactive') trigger_config.inactive_days = Number(inactiveDays) || 7

    const action_config: Record<string, unknown> = {}
    if (actionType === 'send_email') action_config.template_id = emailTemplateId
    if (actionType === 'send_whatsapp') action_config.template_id = waTemplateId
    if (actionType === 'create_activity') {
      action_config.activity_type = activityType
      action_config.title = activityTitle || 'Atividade automática'
      action_config.due_days = Number(dueDays) || 1
    }
    if (actionType === 'send_notification') action_config.message = message || name
    if (actionType === 'move_stage') action_config.to_stage_id = moveStageId

    return {
      name: name.trim(),
      description: description.trim() || null,
      trigger_type: triggerType,
      trigger_config,
      action_type: actionType,
      action_config,
    }
  }

  function validate(): string | null {
    if (!name.trim()) return 'Dá um nome à regra.'
    if (actionType === 'send_email' && !emailTemplateId) return 'Escolhe o template de email.'
    if (actionType === 'send_whatsapp' && !waTemplateId) return 'Escolhe o template de WhatsApp.'
    if (actionType === 'move_stage' && !moveStageId) return 'Escolhe a etapa de destino.'
    if (triggerType === 'lead_inactive' && (Number(inactiveDays) || 0) < 1) return 'Indica os dias de inatividade (mínimo 1).'
    return null
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSaving(true)
    setError('')
    try {
      const res = await fetch(rule ? `/api/automations/${rule.id}` : '/api/automations', {
        method: rule ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (res.ok) {
        onSaved(await res.json())
        onClose()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Erro ao guardar a regra.')
      }
    } catch {
      setError('Erro de rede ao guardar a regra.')
    } finally {
      setSaving(false)
    }
  }

  const waSelected = actionType === 'send_whatsapp' || triggerType === 'whatsapp_message_received'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 18 }}>
            {rule ? 'Editar regra' : 'Nova regra de automação'}
          </div>
          <button onClick={onClose} className="icon-btn"><Icon name="close" size={16} /></button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Nome</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Follow-up após 7 dias sem resposta" />
          </div>

          <div>
            <label className="label">Descrição (opcional)</label>
            <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Para que serve esta regra" />
          </div>

          {/* QUANDO */}
          <div className="card" style={{ padding: '14px 16px', background: 'var(--surface)' }}>
            <div className="label" style={{ color: 'var(--gold)', marginBottom: 10 }}>Quando…</div>
            <select className="input" value={triggerType} onChange={e => setTriggerType(e.target.value as AutomationTriggerType)}>
              {TRIGGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {triggerType === 'stage_changed' && (
              <div style={{ marginTop: 12 }}>
                <label className="label">Para a etapa (vazio = qualquer)</label>
                <select className="input" value={toStageId} onChange={e => setToStageId(e.target.value)}>
                  <option value="">— Qualquer etapa —</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {triggerType === 'lead_inactive' && (
              <div style={{ marginTop: 12 }}>
                <label className="label">Dias sem atividade</label>
                <input className="input" type="number" min={1} value={inactiveDays} onChange={e => setInactiveDays(e.target.value)} />
              </div>
            )}
          </div>

          {/* ENTÃO */}
          <div className="card" style={{ padding: '14px 16px', background: 'var(--surface)' }}>
            <div className="label" style={{ color: 'var(--gold)', marginBottom: 10 }}>Então…</div>
            <select className="input" value={actionType} onChange={e => setActionType(e.target.value as AutomationActionType)}>
              {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {actionType === 'send_email' && (
              <div style={{ marginTop: 12 }}>
                <label className="label">Template de email</label>
                <select className="input" value={emailTemplateId} onChange={e => setEmailTemplateId(e.target.value)}>
                  <option value="">— Escolher template —</option>
                  {emailTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {emailTemplates.length === 0 && (
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    Ainda não há templates. Cria um em Configurações → Templates.
                  </p>
                )}
              </div>
            )}

            {actionType === 'send_whatsapp' && (
              <div style={{ marginTop: 12 }}>
                <label className="label">Template de WhatsApp</label>
                <select className="input" value={waTemplateId} onChange={e => setWaTemplateId(e.target.value)}>
                  <option value="">— Escolher template —</option>
                  {waTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {actionType === 'create_activity' && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">Tipo</label>
                    <select className="input" value={activityType} onChange={e => setActivityType(e.target.value)}>
                      {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ width: 110 }}>
                    <label className="label">Prazo (dias)</label>
                    <input className="input" type="number" min={0} value={dueDays} onChange={e => setDueDays(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Título da atividade</label>
                  <input className="input" value={activityTitle} onChange={e => setActivityTitle(e.target.value)} placeholder="Ex: Ligar à lead" />
                </div>
              </div>
            )}

            {actionType === 'send_notification' && (
              <div style={{ marginTop: 12 }}>
                <label className="label">Mensagem da notificação</label>
                <input className="input" value={message} onChange={e => setMessage(e.target.value)} placeholder="Ex: Esta lead precisa de atenção" />
              </div>
            )}

            {actionType === 'move_stage' && (
              <div style={{ marginTop: 12 }}>
                <label className="label">Mover para a etapa</label>
                <select className="input" value={moveStageId} onChange={e => setMoveStageId(e.target.value)}>
                  <option value="">— Escolher etapa —</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {waSelected && !whatsappConfigured && (
            <div className="badge badge-gold" style={{ alignSelf: 'flex-start', padding: '6px 10px', fontWeight: 500 }}>
              ⚠ WhatsApp Business API não configurada — ver docs/WHATSAPP_SETUP.md
            </div>
          )}

          {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? 'A guardar…' : rule ? 'Guardar alterações' : 'Criar regra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
