'use client'
import { useState, useEffect } from 'react'
import { Pipeline, PipelineCardField, PipelineCardSort, PipelineDaysMode } from '@/types'
import { CARD_FIELD_LABELS } from '@/lib/pipeline/card-fields'

const ALL_FIELDS: PipelineCardField[] = ['name', 'phone', 'email', 'zone', 'typology', 'property', 'property_ref', 'property_type', 'value', 'call_status', 'source', 'notes', 'traits']

const SORT_OPTIONS: { key: PipelineCardSort; label: string; hint: string }[] = [
  { key: 'oldest_first', label: 'Mais tempo na fase primeiro', hint: 'Quem está parado há mais tempo fica em cima.' },
  { key: 'newest_first', label: 'Menos tempo na fase primeiro', hint: 'Entradas recentes em cima.' },
  { key: 'hottest_first', label: 'Contactos mais quentes primeiro', hint: 'Quentes → neutros → frios. A temperatura muda sozinha ao registar chamadas (atendeu = quente, não atendeu = frio).' },
]

const DAYS_OPTIONS: { key: PipelineDaysMode; label: string; hint: string }[] = [
  { key: 'stage', label: 'Dias na fase', hint: 'Conta desde que o card entrou na fase atual.' },
  { key: 'last_contact', label: 'Dias desde o último contacto', hint: 'Conta desde a última chamada, email ou mensagem registada.' },
  { key: 'both', label: 'Os dois, lado a lado', hint: 'Mostra «Fase Xd» e «📞 Xd» no mesmo card.' },
]

const BORDER_PRESETS = ['#B07D2E', '#2563EB', '#7C3AED', '#0F766E', '#DB2777', '#475569']

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
  const [cardSort, setCardSort] = useState<PipelineCardSort>(pipeline?.card_sort ?? 'oldest_first')
  const [daysMode, setDaysMode] = useState<PipelineDaysMode>(pipeline?.days_mode ?? 'stage')
  const [borderColor, setBorderColor] = useState<string | null>(pipeline?.card_border_color ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
        card_sort: cardSort,
        days_mode: daysMode,
        card_border_color: borderColor,
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

  const sectionTitle = (t: string) => <div className="section-label" style={{ marginBottom: 2 }}>{t}</div>

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal pipeline-editor" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div className="font-display" style={{ fontSize: 18 }}>{isEdit ? 'Editar pipeline' : 'Nova pipeline'}</div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="btn btn-ghost btn-sm" style={{ fontSize: 16, lineHeight: 1 }}>×</button>
        </div>

        <div className="pipeline-editor-body">
          {/* Coluna esquerda: geral, ordenação, contagem de dias, aparência */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div className="pipeline-editor-section">
              {sectionTitle('Nome')}
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Arrendamentos" autoFocus required />
            </div>

            <div className="pipeline-editor-section">
              {sectionTitle('Ordenar cards em cada fase')}
              {SORT_OPTIONS.map(o => (
                <label key={o.key} className={`pipeline-editor-option${cardSort === o.key ? ' active' : ''}`}>
                  <input type="radio" name="card_sort" checked={cardSort === o.key} onChange={() => setCardSort(o.key)} style={{ accentColor: 'var(--gold)', marginTop: 2 }} />
                  <span><strong style={{ fontWeight: 600 }}>{o.label}</strong><br /><span style={{ fontSize: 11, color: 'var(--muted)' }}>{o.hint}</span></span>
                </label>
              ))}
            </div>

            <div className="pipeline-editor-section">
              {sectionTitle('Contagem de dias no card')}
              {DAYS_OPTIONS.map(o => (
                <label key={o.key} className={`pipeline-editor-option${daysMode === o.key ? ' active' : ''}`}>
                  <input type="radio" name="days_mode" checked={daysMode === o.key} onChange={() => setDaysMode(o.key)} style={{ accentColor: 'var(--gold)', marginTop: 2 }} />
                  <span><strong style={{ fontWeight: 600 }}>{o.label}</strong><br /><span style={{ fontSize: 11, color: 'var(--muted)' }}>{o.hint}</span></span>
                </label>
              ))}
            </div>

            <div className="pipeline-editor-section">
              {sectionTitle('Cor do border de todos os cards')}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setBorderColor(null)} className={`chip${borderColor === null ? ' active' : ''}`}>Padrão</button>
                {BORDER_PRESETS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBorderColor(c)}
                    aria-label={`Cor ${c}`}
                    style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: borderColor?.toLowerCase() === c.toLowerCase() ? '3px solid var(--text)' : '2px solid var(--card)', boxShadow: '0 0 0 1px var(--border)', cursor: 'pointer' }}
                  />
                ))}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
                  <input type="color" value={borderColor ?? '#B07D2E'} onChange={e => setBorderColor(e.target.value)} style={{ width: 30, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                  Outra
                </label>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
                Têm prioridade sobre esta cor: <span style={{ color: '#DC2626', fontWeight: 600 }}>vermelho</span> = contacto quente ·{' '}
                <span style={{ color: '#16A34A', fontWeight: 600 }}>verde</span> = imóvel com muitas visitas ·{' '}
                <span style={{ color: '#EA8A1A', fontWeight: 600 }}>laranja</span> = poucas ou nenhuma visita.
                Cards com a próxima chamada para hoje (ou atrasada) piscam.
              </div>
            </div>
          </div>

          {/* Coluna direita: campos visíveis */}
          <div className="pipeline-editor-section">
            {sectionTitle('Campos visíveis nos cards')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ALL_FIELDS.map(field => {
                const isSelected = selectedFields.includes(field)
                const idx = selectedFields.indexOf(field)
                return (
                  <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: isSelected ? 'var(--item-bg)' : 'transparent', borderRadius: 6, border: isSelected ? '1px solid var(--border)' : '1px solid transparent' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleField(field)}
                      style={{ accentColor: 'var(--gold)', cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1, fontSize: 13, color: isSelected ? 'var(--text)' : 'var(--muted)' }}>
                      {CARD_FIELD_LABELS[field]}
                      {field === 'traits' && <span style={{ fontSize: 11, color: 'var(--muted)' }}> — ex: ligar ao fim de semana</span>}
                    </span>
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
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Usa ▲▼ para reordenar. A próxima chamada aparece sempre que estiver marcada no contacto.</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '14px 24px', borderTop: '1px solid var(--border)' }}>
          {error && <div style={{ fontSize: 12, color: '#DC2626', marginRight: 'auto' }}>{error}</div>}
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={busy || !name.trim()} className="btn btn-primary">{busy ? 'A guardar…' : isEdit ? 'Guardar' : 'Criar'}</button>
        </div>
      </form>
    </div>
  )
}
