'use client'
import { useState } from 'react'
import { Pipeline, PipelineCardField } from '@/types'
import { CARD_FIELD_LABELS } from '@/lib/pipeline/card-fields'

const ALL_FIELDS: PipelineCardField[] = ['name', 'phone', 'email', 'zone', 'typology', 'property', 'property_ref', 'property_type', 'value', 'call_status', 'source', 'notes']

type Props = {
  pipeline?: Pipeline | null
  onClose: () => void
  onSaved: (p: Pipeline) => void
}

export function PipelineSettingsModal({ pipeline, onClose, onSaved }: Props) {
  const isEdit = !!pipeline
  const [name, setName] = useState(pipeline?.name ?? '')
  const defaultFields: PipelineCardField[] = pipeline?.card_fields ?? [pipeline?.card_primary_field ?? 'name', pipeline?.card_secondary_field ?? 'zone']
  const [selectedFields, setSelectedFields] = useState<PipelineCardField[]>(defaultFields)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleField(field: PipelineCardField) {
    setSelectedFields(prev => {
      if (prev.includes(field)) return prev.filter(f => f !== field)
      return [...prev, field]
    })
  }

  function moveField(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= selectedFields.length) return
    const reordered = [...selectedFields]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(newIndex, 0, moved)
    setSelectedFields(reordered)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (selectedFields.length === 0) { setError('Seleciona pelo menos um campo.'); return }
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        card_fields: selectedFields,
        card_primary_field: selectedFields[0],
        card_secondary_field: selectedFields[1] ?? selectedFields[0],
      }
      const res = await fetch(isEdit ? `/api/pipelines/${pipeline!.id}` : '/api/pipelines', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError((data as { error?: string }).error ?? 'Erro ao guardar pipeline.'); return }
      onSaved(data as Pipeline)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(420px, 92vw)', padding: 24 }}>
        <div className="font-display" style={{ fontSize: 16, marginBottom: 14 }}>{isEdit ? 'Editar pipeline' : 'Nova pipeline'}</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>Nome</div>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Arrendamentos" autoFocus required />
          </div>

          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Campos visíveis nos cards</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ALL_FIELDS.map(field => {
                const isSelected = selectedFields.includes(field)
                const idx = selectedFields.indexOf(field)
                return (
                  <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: isSelected ? 'var(--item-bg)' : 'transparent', borderRadius: 6, border: isSelected ? '1px solid var(--border)' : '1px solid transparent' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleField(field)}
                      style={{ accentColor: 'var(--gold)', cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1, fontSize: 13, color: isSelected ? 'var(--text)' : 'var(--muted)' }}>{CARD_FIELD_LABELS[field]}</span>
                    {isSelected && (
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button type="button" onClick={() => moveField(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 10, opacity: idx === 0 ? 0.3 : 1, padding: '0 2px' }}>▲</button>
                        <button type="button" onClick={() => moveField(idx, 1)} disabled={idx === selectedFields.length - 1} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: idx === selectedFields.length - 1 ? 'default' : 'pointer', fontSize: 10, opacity: idx === selectedFields.length - 1 ? 0.3 : 1, padding: '0 2px' }}>▼</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Arrasta com ▲▼ para reordenar. O primeiro campo fica em destaque.</div>
          </div>

          {error && <div style={{ fontSize: 12, color: '#DC2626' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
            <button type="submit" disabled={busy || !name.trim()} className="btn btn-primary">{busy ? 'A guardar…' : isEdit ? 'Guardar' : 'Criar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
