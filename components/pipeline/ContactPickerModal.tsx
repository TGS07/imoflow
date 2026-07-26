'use client'
import { useState, useEffect, useMemo } from 'react'
import type { Person } from '@/types'

// Popup: lista de contactos A-Z, pesquisa por nome ou telefone, checkbox
// por linha. Os contactos já ativos nesta pipeline aparecem marcados e
// desativados (para os duplicar, usa-se o botão "Duplicar" no card, não
// este picker).
export function ContactPickerModal({ pipelineId, pipelineName, alreadyInIds, onClose, onAdded }: {
  pipelineId: string
  pipelineName: string
  alreadyInIds: Set<string>
  onClose: () => void
  onAdded: () => void
}) {
  const [people, setPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/people')
      .then(r => r.ok ? r.json() : [])
      .then((data: Person[]) => setPeople(
        [...data].sort((a, b) => a.name.trim().localeCompare(b.name.trim(), 'pt'))
      ))
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return people
    const digits = term.replace(/\D/g, '')
    return people.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (digits && (() => { const stored = (p.phone ?? '').replace(/\D/g, ''); return !!stored && (stored.includes(digits) || digits.includes(stored)) })())
    )
  }, [people, search])

  function toggle(id: string) {
    if (alreadyInIds.has(id)) return
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function confirm() {
    if (checked.size === 0) { onClose(); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/add-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_ids: [...checked] }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({})) as { added?: number }
        if (typeof data.added === 'number' && data.added < checked.size) {
          alert(`${data.added} de ${checked.size} contacto(s) foram adicionados — os restantes já estavam ativos nesta pipeline.`)
        }
        onAdded()
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="font-display" style={{ fontSize: 16 }}>Adicionar contactos <span style={{ color: 'var(--muted)', fontSize: 12 }}>→ {pipelineName}</span></div>
            <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <input className="input" placeholder="Pesquisar por nome ou telefone…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '8px 10px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Nenhum contacto encontrado.</div>
          ) : filtered.map(p => {
            const isIn = alreadyInIds.has(p.id)
            const isChecked = isIn || checked.has(p.id)
            return (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: isIn ? 'default' : 'pointer', opacity: isIn ? 0.5 : 1 }}>
                <input type="checkbox" checked={isChecked} disabled={isIn} onChange={() => toggle(p.id)} style={{ width: 15, height: 15, accentColor: '#B07D2E', cursor: isIn ? 'default' : 'pointer' }} />
                <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                {isIn && <span style={{ fontSize: 10, color: 'var(--muted)' }}>já na pipeline</span>}
              </label>
            )
          })}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
          <button onClick={confirm} disabled={saving || checked.size === 0} className="btn btn-primary" style={{ flex: 1 }}>
            {saving ? 'A adicionar…' : `Adicionar${checked.size > 0 ? ` (${checked.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
