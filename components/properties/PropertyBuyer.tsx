// components/properties/PropertyBuyer.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Person, PropertyStatus } from '@/types'
import { formatPhoneDisplay } from '@/lib/whatsapp/utils'

type Buyer = { id: string; name: string; phone: string | null; email: string | null }

export function PropertyBuyer({ propertyId, buyer, status, onChange }: {
  propertyId: string
  buyer: Buyer | null
  status: PropertyStatus
  onChange: () => void
}) {
  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)

  async function doSearch(q: string) {
    setSearch(q)
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/people?search=${encodeURIComponent(q.trim())}`)
      if (res.ok) setResults(await res.json())
    } finally { setLoading(false) }
  }

  async function setBuyer(buyerId: string | null) {
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyer_id: buyerId }),
    })
    if (res.ok) { setPicking(false); setSearch(''); setResults([]); onChange() }
  }

  const labelStyle = { fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }
  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="font-display" style={{ fontSize: 15 }}>Comprador</div>
        {!picking && (
          <button onClick={() => setPicking(true)} className="btn btn-soft btn-sm">
            {buyer ? 'Alterar' : 'Definir'}
          </button>
        )}
      </div>

      {!picking && (
        buyer ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Link href={`/people/${buyer.id}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>{buyer.name}</Link>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{(buyer.phone ? formatPhoneDisplay(buyer.phone) : buyer.phone) || buyer.email || 'Sem contacto'}</div>
            </div>
            <button onClick={() => setBuyer(null)} className="btn btn-danger btn-sm" style={{ padding: '2px 8px' }}>Remover</button>
          </div>
        ) : status === 'vendido' ? (
          <div style={{ fontSize: 12, color: '#D97706', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 8, padding: '8px 12px' }}>
            Vendido — sem comprador registado.
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum comprador associado.</div>
        )
      )}

      {picking && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={labelStyle}>Procurar contacto</div>
          <input style={inputStyle} autoFocus placeholder="Nome, telefone ou email..." value={search} onChange={e => doSearch(e.target.value)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
            {loading && <div style={{ fontSize: 12, color: 'var(--muted)' }}>A procurar...</div>}
            {!loading && search.trim().length >= 2 && results.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum contacto encontrado.</div>}
            {results.map(p => (
              <button key={p.id} onClick={() => setBuyer(p.id)} className="table-row" style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(p.phone ? formatPhoneDisplay(p.phone) : p.phone) || p.email || ''}</div>
              </button>
            ))}
          </div>
          <button onClick={() => { setPicking(false); setSearch(''); setResults([]) }} className="btn btn-ghost" style={{ fontSize: 12, alignSelf: 'flex-start' }}>Cancelar</button>
        </div>
      )}
    </div>
  )
}
