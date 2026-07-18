'use client'
import { useState } from 'react'
import { Pipeline, PipelineCardField } from '@/types'

const CARD_FIELDS: { key: PipelineCardField; label: string }[] = [
  { key: 'name', label: 'Nome' },
  { key: 'zone', label: 'Zona' },
  { key: 'property', label: 'Imóvel' },
  { key: 'typology', label: 'Tipologia' },
  { key: 'value', label: 'Valor' },
]

type Props = {
  pipeline?: Pipeline | null // null/undefined = criar nova
  onClose: () => void
  onSaved: (p: Pipeline) => void
}

// Mini-modal de criação/edição de pipeline: nome + que campo aparece em
// grande (principal) e em pequeno (secundário) nos cards do kanban.
export function PipelineSettingsModal({ pipeline, onClose, onSaved }: Props) {
  const isEdit = !!pipeline
  const [name, setName] = useState(pipeline?.name ?? '')
  const [primary, setPrimary] = useState<PipelineCardField>(pipeline?.card_primary_field ?? 'name')
  const [secondary, setSecondary] = useState<PipelineCardField>(pipeline?.card_secondary_field ?? 'zone')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A secundária nunca pode ser igual à principal
  function changePrimary(v: PipelineCardField) {
    setPrimary(v)
    if (v === secondary) setSecondary(CARD_FIELDS.find(f => f.key !== v)!.key)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(isEdit ? `/api/pipelines/${pipeline!.id}` : '/api/pipelines', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), card_primary_field: primary, card_secondary_field: secondary }),
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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(380px, 92vw)', padding: 24 }}>
        <div className="font-display" style={{ fontSize: 16, marginBottom: 14 }}>{isEdit ? 'Editar pipeline' : 'Nova pipeline'}</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>Nome</div>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Arrendamentos" autoFocus required />
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>Info principal do card</div>
            <select className="input" value={primary} onChange={e => changePrimary(e.target.value as PipelineCardField)}>
              {CARD_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>Info secundária</div>
            <select className="input" value={secondary} onChange={e => setSecondary(e.target.value as PipelineCardField)}>
              {CARD_FIELDS.filter(f => f.key !== primary).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
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
