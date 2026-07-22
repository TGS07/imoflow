'use client'
import { useState, useEffect, useRef } from 'react'
import type { Property, Person } from '@/types'

type SelectedItem = {
  property: Property
  personId: string | null
  personQuery: string
  personResults: Person[]
  showPersonDropdown: boolean
}

// Popup: pesquisa de imóveis (debounced, como no NewLeadModal), cada imóvel
// escolhido entra numa lista de selecionados onde também se escolhe a
// pessoa associada (pré-preenchida com o vendedor/comprador do imóvel,
// quando existir — sempre editável). Ao contrário do antigo picker de
// contactos, a mesma pessoa pode ser adicionada várias vezes desde que
// ligada a imóveis diferentes; duplicados exatos são filtrados no servidor.
export function PropertyPickerModal({ pipelineId, pipelineName, onClose, onAdded }: {
  pipelineId: string
  pipelineName: string
  onClose: () => void
  onAdded: () => void
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Property[]>([])
  const [selected, setSelected] = useState<SelectedItem[]>([])
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)

  useEffect(() => {
    if (!search) { setResults([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/properties?search=${encodeURIComponent(search)}`)
      if (res.ok) setResults(await res.json())
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearchDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function addProperty(property: Property) {
    setSearch('')
    setResults([])
    setShowSearchDropdown(false)
    setSelected(prev => [...prev, { property, personId: null, personQuery: '', personResults: [], showPersonDropdown: false }])

    const res = await fetch(`/api/properties/${property.id}`)
    if (!res.ok) return
    const full = await res.json() as { seller?: Person | null; buyer?: Person | null }
    const preselected = full.seller ?? full.buyer ?? null
    if (!preselected) return
    setSelected(prev => prev.map(item => item.property.id === property.id
      ? { ...item, personId: preselected.id, personQuery: preselected.name }
      : item))
  }

  function removeItem(propertyId: string) {
    setSelected(prev => prev.filter(item => item.property.id !== propertyId))
  }

  function updateItem(propertyId: string, patch: Partial<SelectedItem>) {
    setSelected(prev => prev.map(item => item.property.id === propertyId ? { ...item, ...patch } : item))
  }

  function searchPerson(propertyId: string, query: string) {
    updateItem(propertyId, { personQuery: query, showPersonDropdown: true })
    if (!query) { updateItem(propertyId, { personResults: [] }); return }
    fetch(`/api/people?search=${encodeURIComponent(query)}`)
      .then(r => r.ok ? r.json() : [])
      .then((people: Person[]) => updateItem(propertyId, { personResults: people }))
      .catch(() => {})
  }

  async function confirm() {
    if (selected.length === 0) { onClose(); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/add-properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selected.map(s => ({ property_id: s.property.id, person_id: s.personId })),
        }),
      })
      if (res.ok) { onAdded(); onClose() }
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: '100%', maxWidth: 460, maxHeight: '85vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="font-display" style={{ fontSize: 16 }}>Adicionar imóveis <span style={{ color: 'var(--muted)', fontSize: 12 }}>→ {pipelineName}</span></div>
            <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <div ref={searchRef} style={{ position: 'relative' }}>
            <input
              className="input"
              placeholder="Pesquisar imóvel por referência, título ou morada…"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSearchDropdown(true) }}
              onFocus={() => setShowSearchDropdown(true)}
              autoFocus
            />
            {showSearchDropdown && search && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto', zIndex: 10 }}>
                {results.filter(p => !selected.some(s => s.property.id === p.id)).map(p => (
                  <div key={p.id} onClick={() => addProperty(p)} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 500 }}>{p.reference ? `${p.reference} — ` : ''}{p.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.price ? `€${p.price.toLocaleString('pt-PT')}` : ''} {p.zone ?? ''}</div>
                  </div>
                ))}
                {results.length === 0 && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>Nenhum imóvel encontrado</div>}
              </div>
            )}
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '10px 20px' }}>
          {selected.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Pesquisa e escolhe imóveis para adicionar.</div>
          ) : selected.map(item => (
            <div key={item.property.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.property.reference ? `${item.property.reference} — ` : ''}{item.property.title}</div>
                <button onClick={() => removeItem(item.property.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  style={inputStyle}
                  placeholder="Pessoa associada (opcional)…"
                  value={item.personQuery}
                  onChange={e => { updateItem(item.property.id, { personId: null }); searchPerson(item.property.id, e.target.value) }}
                  onFocus={() => updateItem(item.property.id, { showPersonDropdown: true })}
                />
                {item.showPersonDropdown && item.personQuery && !item.personId && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 140, overflowY: 'auto', zIndex: 10 }}>
                    {item.personResults.map(p => (
                      <div key={p.id} onClick={() => updateItem(item.property.id, { personId: p.id, personQuery: p.name, showPersonDropdown: false })} style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                        {p.name}
                      </div>
                    ))}
                    {item.personResults.length === 0 && <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--muted)' }}>Nenhuma pessoa encontrada</div>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
          <button onClick={confirm} disabled={saving || selected.length === 0} className="btn btn-primary" style={{ flex: 1 }}>
            {saving ? 'A adicionar…' : `Adicionar${selected.length > 0 ? ` (${selected.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
