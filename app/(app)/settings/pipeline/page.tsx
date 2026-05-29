'use client'
import { useState, useEffect } from 'react'
import { PipelineStage, CustomField } from '@/types'

const COLORS = ['#3B82F6', '#F59E0B', '#8B5CF6', '#F97316', '#10B981', '#EF4444', '#EC4899', '#6366F1', '#14B8A6', '#F43F5E']
const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Numero' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Lista' },
  { value: 'boolean', label: 'Sim/Nao' },
  { value: 'currency', label: 'Moeda' },
]

export default function PipelineSettingsPage() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [newStageName, setNewStageName] = useState('')
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState('text')
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }

  useEffect(() => {
    Promise.all([
      fetch('/api/pipeline-stages').then(r => r.json()),
      fetch('/api/custom-fields').then(r => r.json()),
    ]).then(([s, f]) => { setStages(s); setCustomFields(f) })
  }, [])

  async function addStage(e: React.FormEvent) {
    e.preventDefault()
    if (!newStageName.trim()) return
    const res = await fetch('/api/pipeline-stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newStageName, color: COLORS[stages.length % COLORS.length] }),
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
    if (!confirm('Eliminar esta etapa? Os leads serao movidos para a primeira etapa.')) return
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
    if (!confirm('Eliminar este campo? Todos os valores serao perdidos.')) return
    await fetch(`/api/custom-fields/${id}`, { method: 'DELETE' })
    setCustomFields(prev => prev.filter(f => f.id !== id))
  }

  return (
    <>
      <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 className="font-display" style={{ fontSize: 20 }}>Configuracoes do Pipeline</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Personaliza as etapas e campos do teu CRM</p>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 720 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 22, marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 16, marginBottom: 16 }}>Etapas do Pipeline</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {stages.map((stage, i) => (
              <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => moveStage(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: i === 0 ? 'default' : 'pointer', fontSize: 10, opacity: i === 0 ? 0.3 : 1, padding: 0 }}>▲</button>
                  <button onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: i === stages.length - 1 ? 'default' : 'pointer', fontSize: 10, opacity: i === stages.length - 1 ? 0.3 : 1, padding: 0 }}>▼</button>
                </div>
                <input
                  type="color"
                  value={stage.color}
                  onChange={e => updateStage(stage.id, { color: e.target.value })}
                  style={{ width: 24, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={stage.name}
                  onChange={e => updateStage(stage.id, { name: e.target.value })}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', minWidth: 80 }}>
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
                <div style={{ display: 'flex', gap: 4, fontSize: 9 }}>
                  {stage.is_won && <span style={{ padding: '2px 6px', borderRadius: 3, background: '#10B98122', color: '#10B981', fontWeight: 600 }}>WON</span>}
                  {stage.is_lost && <span style={{ padding: '2px 6px', borderRadius: 3, background: '#EF444422', color: '#EF4444', fontWeight: 600 }}>LOST</span>}
                </div>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} placeholder="Nome do campo..." value={newFieldName} onChange={e => setNewFieldName(e.target.value)} />
              <select style={inputStyle} value={newFieldType} onChange={e => setNewFieldType(e.target.value)}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button type="submit" style={{ ...inputStyle, background: 'var(--gold)', color: '#0D0D0F', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Adicionar</button>
            </div>
            {(newFieldType === 'select' || newFieldType === 'multiselect') && (
              <input style={inputStyle} placeholder="Opcoes separadas por virgula (ex: Opcao A, Opcao B)" value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} />
            )}
          </form>
        </div>
      </div>
    </>
  )
}
