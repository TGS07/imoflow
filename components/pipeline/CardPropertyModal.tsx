'use client'
import { useState, useEffect } from 'react'
import type { ContactPropertyCandidate } from '@/lib/pipeline/resolve-contact-property'

// Popup para escolher/trocar o imóvel de um card específico da pipeline —
// pesquisa em toda a carteira da agência (não só os imóveis já associados
// ao contacto), tal como o picker de comprador em PropertyBuyer.tsx. Se o
// card tiver um contacto associado, mostra logo os imóveis já ligados a
// esse contacto (vendedor/comprador candidato/consultor) como sugestões,
// antes de o consultor precisar de pesquisar do zero.
export function CardPropertyModal({ currentPropertyId, currentPropertyLabel, personId, onClose, onSelect, onRemove }: {
  currentPropertyId: string | null
  currentPropertyLabel: string | null
  personId: string | null
  onClose: () => void
  onSelect: (property: ContactPropertyCandidate) => void
  onRemove: () => void
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<ContactPropertyCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [suggested, setSuggested] = useState<ContactPropertyCandidate[]>([])

  useEffect(() => {
    if (!personId) { setSuggested([]); return }
    fetch(`/api/people/${personId}/candidate-properties`)
      .then(r => r.ok ? r.json() : [])
      .then(setSuggested)
      .catch(() => setSuggested([]))
  }, [personId])

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/properties?search=${encodeURIComponent(search.trim())}`)
      setResults(res.ok ? await res.json() : [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const visibleSuggested = suggested.filter(p => p.id !== currentPropertyId)

  const propertyRow = (p: ContactPropertyCandidate) => (
    <button
      key={p.id}
      onClick={() => onSelect(p)}
      className="table-row"
      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 4, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.reference ? `${p.reference} — ${p.title}` : p.title}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.price ? `€${p.price.toLocaleString('pt-PT')}` : ''} {p.zone ?? ''}</div>
    </button>
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: '100%', maxWidth: 420, maxHeight: '75vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="font-display" style={{ fontSize: 16 }}>Imóvel do card</div>
            <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          {currentPropertyLabel && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <span style={{ fontSize: 12 }}>{currentPropertyLabel}</span>
              <button onClick={onRemove} className="btn btn-danger btn-sm" style={{ padding: '2px 8px' }}>Remover</button>
            </div>
          )}
          <input className="input" placeholder="Pesquisar imóvel por referência, título ou morada…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '8px 10px' }}>
          {!search.trim() && visibleSuggested.length > 0 && (
            <>
              <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '4px 12px 6px', fontWeight: 500 }}>Sugeridos para este contacto</div>
              {visibleSuggested.map(propertyRow)}
            </>
          )}
          {!search.trim() && visibleSuggested.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Pesquisa e escolhe um imóvel.</div>
          )}
          {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>A procurar…</div>}
          {!loading && search.trim() && results.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Nenhum imóvel encontrado.</div>
          )}
          {!loading && search.trim() && results.filter(p => p.id !== currentPropertyId).map(propertyRow)}
        </div>
      </div>
    </div>
  )
}
