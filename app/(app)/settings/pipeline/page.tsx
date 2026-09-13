'use client'
import { useState, useEffect } from 'react'
import { HelpButton } from '@/components/help/HelpButton'
import { Icon } from '@/components/ui/Icon'
import { StageNotificationsModal } from '@/components/pipeline/StageNotificationsModal'
import { PipelineStage, CustomField, Pipeline } from '@/types'

const COLORS = ['#3B82F6', '#F59E0B', '#8B5CF6', '#F97316', '#10B981', '#EF4444', '#EC4899', '#6366F1', '#14B8A6', '#F43F5E']
const SWATCH_COLORS = ['#3B82F6', '#2563EB', '#8B5CF6', '#7C3AED', '#EC4899', '#EF4444', '#F59E0B', '#F97316', '#10B981', '#059669', '#06B6D4', '#6B7280']

type PipelineTemplate = {
  name: string
  stages: { name: string; color: string; probability: number; is_won?: boolean; is_lost?: boolean }[]
}

const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    name: 'Vendas',
    stages: [
      { name: 'Novo Lead', color: '#3B82F6', probability: 10 },
      { name: 'Contacto', color: '#06B6D4', probability: 20 },
      { name: 'Visita', color: '#8B5CF6', probability: 40 },
      { name: 'Proposta', color: '#F59E0B', probability: 60 },
      { name: 'Negociação', color: '#F97316', probability: 80 },
      { name: 'Ganho', color: '#10B981', probability: 100, is_won: true },
      { name: 'Perdido', color: '#EF4444', probability: 0, is_lost: true },
    ],
  },
  {
    name: 'Arrendamento',
    stages: [
      { name: 'Novo', color: '#3B82F6', probability: 10 },
      { name: 'Visita', color: '#8B5CF6', probability: 30 },
      { name: 'Documentação', color: '#F59E0B', probability: 60 },
      { name: 'Contrato', color: '#F97316', probability: 80 },
      { name: 'Ativo', color: '#10B981', probability: 100, is_won: true },
      { name: 'Cancelado', color: '#EF4444', probability: 0, is_lost: true },
    ],
  },
  {
    name: 'Compra',
    stages: [
      { name: 'Prospeção', color: '#3B82F6', probability: 10 },
      { name: 'Análise', color: '#06B6D4', probability: 25 },
      { name: 'Proposta', color: '#F59E0B', probability: 50 },
      { name: 'Escritura', color: '#F97316', probability: 80 },
      { name: 'Concluído', color: '#10B981', probability: 100, is_won: true },
      { name: 'Cancelado', color: '#EF4444', probability: 0, is_lost: true },
    ],
  },
]
const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Lista' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'currency', label: 'Moeda' },
]

export default function PipelineSettingsPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [newStageName, setNewStageName] = useState('')
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState('text')
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [notifStage, setNotifStage] = useState<PipelineStage | null>(null)
  const [editingColor, setEditingColor] = useState<string | null>(null)
  // etapas com avisos ativos (para o 🔔 dourado) — derivado das regras da agência
  const [notifiedStageIds, setNotifiedStageIds] = useState<Set<string>>(new Set())

  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-body)' }

  useEffect(() => {
    Promise.all([
      fetch('/api/pipelines').then(r => r.json()),
      fetch('/api/custom-fields').then(r => r.json()),
    ]).then(([p, f]: [Pipeline[], CustomField[]]) => {
      setPipelines(p)
      setCustomFields(f)
      setSelectedPipelineId(p[0]?.id ?? null)
    })
  }, [])

  // Carregar etapas da pipeline selecionada
  useEffect(() => {
    if (!selectedPipelineId) { setStages([]); return }
    fetch(`/api/pipeline-stages?pipeline_id=${selectedPipelineId}`)
      .then(r => r.json())
      .then((s: PipelineStage[]) => setStages(s))
  }, [selectedPipelineId])

  // Deriva das regras de automação quais etapas têm avisos ativos
  async function loadNotifiedStages() {
    try {
      const res = await fetch('/api/automations')
      if (!res.ok) return
      const rules: { is_active: boolean; trigger_type: string; trigger_config: Record<string, unknown> }[] = await res.json()
      const ids = new Set<string>()
      for (const r of rules) {
        if (!r.is_active) continue
        if (r.trigger_type === 'stage_changed' && typeof r.trigger_config?.to_stage_id === 'string') ids.add(r.trigger_config.to_stage_id as string)
        if (r.trigger_type === 'lead_inactive' && typeof r.trigger_config?.stage_id === 'string') ids.add(r.trigger_config.stage_id as string)
      }
      setNotifiedStageIds(ids)
    } catch { /* badge é decorativo */ }
  }

  useEffect(() => { loadNotifiedStages() }, [])

  async function applyTemplate(template: PipelineTemplate) {
    if (!selectedPipelineId) return
    if (stages.length > 0 && !confirm(`Isto vai substituir todas as etapas atuais pelas do template "${template.name}". Continuar?`)) return
    // Delete existing stages
    for (const stage of stages) {
      await fetch(`/api/pipeline-stages/${stage.id}`, { method: 'DELETE' })
    }
    // Create new stages from template
    const newStages: PipelineStage[] = []
    for (let i = 0; i < template.stages.length; i++) {
      const t = template.stages[i]
      const res = await fetch('/api/pipeline-stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: t.name,
          color: t.color,
          probability: t.probability,
          pipeline_id: selectedPipelineId,
          is_won: t.is_won ?? false,
          is_lost: t.is_lost ?? false,
          position: i,
        }),
      })
      if (res.ok) newStages.push(await res.json())
    }
    setStages(newStages)
  }

  async function addStage(e: React.FormEvent) {
    e.preventDefault()
    if (!newStageName.trim() || !selectedPipelineId) return
    const res = await fetch('/api/pipeline-stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newStageName, color: COLORS[stages.length % COLORS.length], pipeline_id: selectedPipelineId }),
    })
    if (res.ok) {
      const stage = await res.json()
      setStages(prev => [...prev, stage])
      setNewStageName('')
    }
  }

  async function updateStage(id: string, updates: Partial<PipelineStage>) {
    setSaving(id)
    await fetch(`/api/pipeline-stages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    setSaving(null)
  }

  async function deleteStage(id: string) {
    if (!confirm('Eliminar esta etapa? Os leads serão movidos para a primeira etapa.')) return
    await fetch(`/api/pipeline-stages/${id}`, { method: 'DELETE' })
    setStages(prev => prev.filter(s => s.id !== id))
  }

  async function moveStage(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= stages.length) return
    const reordered = [...stages]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(newIndex, 0, moved)
    const withPositions = reordered.map((s, i) => ({ ...s, position: i }))
    setStages(withPositions)
    await fetch('/api/pipeline-stages/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stages: withPositions.map(s => ({ id: s.id, position: s.position })) }),
    })
  }

  async function addField(e: React.FormEvent) {
    e.preventDefault()
    if (!newFieldName.trim()) return
    const body: Record<string, unknown> = { name: newFieldName, field_type: newFieldType }
    if ((newFieldType === 'select' || newFieldType === 'multiselect') && newFieldOptions.trim()) {
      body.options = newFieldOptions.split(',').map(o => o.trim()).filter(Boolean)
    }
    const res = await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const field = await res.json()
      setCustomFields(prev => [...prev, field])
      setNewFieldName('')
      setNewFieldOptions('')
    }
  }

  async function deleteField(id: string) {
    if (!confirm('Eliminar este campo? Todos os valores serão perdidos.')) return
    await fetch(`/api/custom-fields/${id}`, { method: 'DELETE' })
    setCustomFields(prev => prev.filter(f => f.id !== id))
  }

  return (
    <>
      {notifStage && (
        <StageNotificationsModal
          stageId={notifStage.id}
          stageName={notifStage.name}
          onClose={() => setNotifStage(null)}
          onSaved={loadNotifiedStages}
        />
      )}
      <div className="page-enter" style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: 720 }}>
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h1 className="font-display" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.1 }}>Configurações do Pipeline <HelpButton section="settings-pipeline" /></h1>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 'var(--space-1)' }}>Personaliza as etapas e campos do teu CRM</p>
        </div>

        <div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 22, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="font-display" style={{ fontSize: 16 }}>Etapas da Pipeline</div>
            {pipelines.length > 0 && (
              <select style={inputStyle} value={selectedPipelineId ?? ''} onChange={e => setSelectedPipelineId(e.target.value)}>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          {stages.length === 0 && selectedPipelineId && (
            <div style={{ marginBottom: 16, padding: 16, background: 'var(--item-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Começar com um template:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PIPELINE_TEMPLATES.map(t => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}
                  >
                    <Icon name="pipeline" size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {stages.map((stage, i) => (
              <div key={stage.id} className="stage-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => moveStage(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: i === 0 ? 'default' : 'pointer', fontSize: 10, opacity: i === 0 ? 0.3 : 1, padding: 0 }}>▲</button>
                  <button onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: i === stages.length - 1 ? 'default' : 'pointer', fontSize: 10, opacity: i === stages.length - 1 ? 0.3 : 1, padding: 0 }}>▼</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setEditingColor(editingColor === stage.id ? null : stage.id)}
                    style={{ width: 24, height: 24, borderRadius: '50%', background: stage.color, border: '2px solid var(--border)', cursor: 'pointer', padding: 0 }}
                    title="Escolher cor"
                  />
                  {editingColor === stage.id && (
                    <div style={{ position: 'absolute', top: 32, left: 0, zIndex: 20, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, boxShadow: 'var(--shadow-md)' }}>
                      <div className="color-swatch-grid">
                        {SWATCH_COLORS.map(c => (
                          <button
                            key={c}
                            type="button"
                            className={`color-swatch${stage.color === c ? ' active' : ''}`}
                            style={{ background: c }}
                            onClick={() => { updateStage(stage.id, { color: c }); setEditingColor(null) }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={stage.name}
                  onChange={e => updateStage(stage.id, { name: e.target.value })}
                />
                <div className="stage-prob hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', minWidth: 80 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={stage.probability}
                    onChange={e => updateStage(stage.id, { probability: Number(e.target.value) })}
                    style={{ ...inputStyle, width: 50, textAlign: 'center' as const }}
                  />
                  <span>%</span>
                </div>
                <div className="hide-mobile" style={{ display: 'flex', gap: 4, fontSize: 9 }}>
                  {stage.is_won && <span style={{ padding: '2px 6px', borderRadius: 3, background: '#10B98122', color: '#10B981', fontWeight: 600 }}>WON</span>}
                  {stage.is_lost && <span style={{ padding: '2px 6px', borderRadius: 3, background: '#EF444422', color: '#EF4444', fontWeight: 600 }}>LOST</span>}
                </div>
                <button
                  onClick={() => setNotifStage(stage)}
                  title="Notificações desta etapa"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 4px', filter: notifiedStageIds.has(stage.id) ? 'none' : 'grayscale(1) opacity(0.45)' }}
                >
                  🔔
                </button>
                <button
                  onClick={() => deleteStage(stage.id)}
                  disabled={stages.length <= 1 || saving === stage.id}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: stages.length <= 1 ? 'default' : 'pointer', fontSize: 14, opacity: stages.length <= 1 ? 0.3 : 1, padding: '0 4px' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={addStage} style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Nova etapa..." value={newStageName} onChange={e => setNewStageName(e.target.value)} />
            <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#0D0D0F', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Adicionar</button>
          </form>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
          <div className="font-display" style={{ fontSize: 16, marginBottom: 16 }}>Campos Personalizados</div>

          {customFields.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {customFields.map(field => (
                <div key={field.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{field.name}</div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>
                    {FIELD_TYPES.find(t => t.value === field.field_type)?.label ?? field.field_type}
                  </span>
                  {field.required && <span style={{ fontSize: 9, color: 'var(--gold)' }}>Obrigatório</span>}
                  {field.options && (
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{(field.options as string[]).join(', ')}</span>
                  )}
                  <button onClick={() => deleteField(field.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addField} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="form-row-wrap" style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1, minWidth: 140 }} placeholder="Nome do campo..." value={newFieldName} onChange={e => setNewFieldName(e.target.value)} />
              <select style={inputStyle} value={newFieldType} onChange={e => setNewFieldType(e.target.value)}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#0D0D0F', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Adicionar</button>
            </div>
            {(newFieldType === 'select' || newFieldType === 'multiselect') && (
              <input style={inputStyle} placeholder="Opções separadas por vírgula (ex: Opção A, Opção B)" value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} />
            )}
          </form>
        </div>
      </div>
      </div>
    </>
  )
}
