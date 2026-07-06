// components/properties/PropertyVisits.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { Person } from '@/types'

type Visit = {
  id: string
  person_id: string | null
  visitor_name: string | null
  agency_name: string | null
  visited_at: string
  notes: string | null
  people?: { id: string; name: string } | null
}

export function PropertyVisits({ propertyId }: { propertyId: string }) {
  const [visits, setVisits] = useState<Visit[]>([])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [selected, setSelected] = useState<Person | null>(null)
  const [visitorName, setVisitorName] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [visitedAt, setVisitedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}/visits`)
    if (res.ok) setVisits(await res.json())
  }, [propertyId])
  useEffect(() => { load() }, [load])

  async function doSearch(q: string) {
    setSearch(q); setSelected(null)
    if (q.trim().length < 2) { setResults([]); return }
    const res = await fetch(`/api/people?search=${encodeURIComponent(q.trim())}`)
    if (res.ok) setResults(await res.json())
  }

  function reset() {
    setAdding(false); setSearch(''); setResults([]); setSelected(null)
    setVisitorName(''); setAgencyName(''); setNotes(''); setVisitedAt(new Date().toISOString().slice(0, 10))
  }

  async function add() {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/visits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: selected?.id ?? null,
          visitor_name: selected ? null : (visitorName || null),
          agency_name: agencyName || null,
          visited_at: visitedAt ? new Date(visitedAt).toISOString() : undefined,
          notes: notes || null,
        }),
      })
      if (res.ok) { reset(); await load() }
    } finally { setSaving(false) }
  }

  const labelStyle = { fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }
  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif', width: '100%' }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="font-display" style={{ fontSize: 15 }}>Visitas</div>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 12px', fontSize: 11, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>+ Registar</button>
        )}
      </div>

      {adding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div>
            <div style={labelStyle}>Contacto (opcional)</div>
            {selected ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.name}</span>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <>
                <input style={inputStyle} placeholder="Procurar contacto..." value={search} onChange={e => doSearch(e.target.value)} />
                {results.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, maxHeight: 160, overflowY: 'auto' }}>
                    {results.map(p => (
                      <button key={p.id} onClick={() => { setSelected(p); setResults([]); setSearch('') }} style={{ textAlign: 'left', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.phone || p.email || ''}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {!selected && (
            <div>
              <div style={labelStyle}>Ou nome de quem visitou</div>
              <input style={inputStyle} placeholder="Nome" value={visitorName} onChange={e => setVisitorName(e.target.value)} />
            </div>
          )}
          <div>
            <div style={labelStyle}>Agência (opcional)</div>
            <input style={inputStyle} placeholder="Agência" value={agencyName} onChange={e => setAgencyName(e.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Data</div>
            <input type="date" style={inputStyle} value={visitedAt} onChange={e => setVisitedAt(e.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Notas</div>
            <input style={inputStyle} placeholder="Notas" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }}>Cancelar</button>
            <button onClick={add} disabled={saving} className="btn btn-primary" style={{ flex: 1, fontSize: 12 }}>{saving ? 'A guardar...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visits.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sem visitas registadas.</div>}
        {visits.map(v => {
          const name = v.people?.name || v.visitor_name || 'Visitante'
          return (
            <div key={v.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {v.people ? (
                  <Link href={`/people/${v.people.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>{name}</Link>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
                )}
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(v.visited_at).toLocaleDateString('pt-PT')}</span>
              </div>
              {(v.agency_name || v.notes) && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  {v.agency_name}{v.agency_name && v.notes ? ' · ' : ''}{v.notes}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
