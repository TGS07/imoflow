// components/contacts/SellerProperties.tsx
// Imóveis deste contacto enquanto vendedor (seller_id) + associar um imóvel
// existente. Reaproveita o PATCH /api/properties/[id] (mesmo endpoint usado
// pela ficha do imóvel em PropertySeller.tsx) — a associação é a mesma coisa
// vista dos dois lados.
'use client'
import { useState } from 'react'
import Link from 'next/link'

type PropertyRef = { id: string; title: string; status: string; price: number | null; reference: string | null }

export function SellerProperties({ personId, properties, onChange }: {
  personId: string
  properties: PropertyRef[]
  onChange: () => void
}) {
  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<PropertyRef[]>([])
  const [loading, setLoading] = useState(false)

  async function doSearch(q: string) {
    setSearch(q)
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/properties?search=${encodeURIComponent(q.trim())}`)
      if (res.ok) setResults(await res.json())
    } finally { setLoading(false) }
  }

  async function associate(propertyId: string) {
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seller_id: personId }),
    })
    if (res.ok) { setPicking(false); setSearch(''); setResults([]); onChange() }
  }

  async function remove(propertyId: string) {
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seller_id: null }),
    })
    if (res.ok) onChange()
  }

  const labelStyle = { fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }
  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif', width: '100%' }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="font-display" style={{ fontSize: 15 }}>Imóveis deste vendedor</div>
        {!picking && (
          <button onClick={() => setPicking(true)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 12px', fontSize: 11, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>
            Associar imóvel
          </button>
        )}
      </div>

      {!picking && (
        properties.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {properties.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                <Link href={`/properties/${p.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
                  {p.reference ? `${p.reference} — ` : ''}{p.title}
                </Link>
                <button onClick={() => remove(p.id)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11, cursor: 'pointer' }}>Remover</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum imóvel associado.</div>
        )
      )}

      {picking && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={labelStyle}>Procurar imóvel</div>
          <input style={inputStyle} autoFocus placeholder="Título, referência ou morada..." value={search} onChange={e => doSearch(e.target.value)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
            {loading && <div style={{ fontSize: 12, color: 'var(--muted)' }}>A procurar...</div>}
            {!loading && search.trim().length >= 2 && results.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum imóvel encontrado.</div>}
            {results.map(p => (
              <button key={p.id} onClick={() => associate(p.id)} style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.reference ? `${p.reference} — ` : ''}{p.title}</div>
              </button>
            ))}
          </div>
          <button onClick={() => { setPicking(false); setSearch(''); setResults([]) }} className="btn btn-ghost" style={{ fontSize: 12, alignSelf: 'flex-start' }}>Cancelar</button>
        </div>
      )}
    </div>
  )
}
