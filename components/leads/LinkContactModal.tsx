'use client'
import { useState, useEffect } from 'react'
import type { Person } from '@/types'

type Props = {
  leadId: string
  onClose: () => void
  onLinked: () => void
}

// Liga a lead a um contacto já existente (em vez do contacto criado
// automaticamente pelo trigger `leads_ensure_contact`). Útil quando o
// comprador desta lead já está guardado nos Contactos.
export function LinkContactModal({ leadId, onClose, onLinked }: Props) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/people?search=${encodeURIComponent(search.trim())}`)
      if (res.ok) setResults(await res.json())
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  async function link(personId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId }),
      })
      if (res.ok) { onLinked(); onClose() }
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Inter, sans-serif' }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div className="font-display" style={{ fontSize: 16 }}>Ligar a um contacto existente</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Esta lead já tem um contacto criado automaticamente. Se este comprador já está guardado nos Contactos, pesquisa e liga-o aqui em vez de manter o contacto genérico.
        </p>
        <input
          autoFocus
          style={inputStyle}
          placeholder="Pesquisar por nome, email ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ marginTop: 10, maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => link(p.id)}
              disabled={saving}
              style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.email ?? p.phone ?? ''}</div>
            </button>
          ))}
          {search.trim() && results.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>Nenhum contacto encontrado.</div>
          )}
        </div>
      </div>
    </div>
  )
}
