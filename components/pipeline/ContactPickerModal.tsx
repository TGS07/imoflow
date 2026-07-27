'use client'
import { useState, useEffect, useMemo } from 'react'
import type { Person } from '@/types'

type PropertyRef = { id: string; title: string; reference: string | null }
type PersonWithProperties = Person & {
  properties_as_seller?: PropertyRef[]
  properties_as_buyer?: PropertyRef[]
  property_consultants?: { properties: PropertyRef }[]
}
type Ambiguous = { id: string; name: string; properties: PropertyRef[] }

function candidatesOf(person: PersonWithProperties): PropertyRef[] {
  const seller = person.properties_as_seller ?? []
  const buyer = person.properties_as_buyer ?? []
  const consultant = (person.property_consultants ?? []).map(pc => pc.properties)
  const byId = new Map<string, PropertyRef>()
  for (const p of [...seller, ...buyer, ...consultant]) byId.set(p.id, p)
  return [...byId.values()]
}

// Popup: lista de contactos A-Z, pesquisa por nome ou telefone, checkbox
// por linha. Os contactos já ativos nesta pipeline aparecem marcados e
// desativados (para os duplicar, usa-se o botão "Duplicar" no card, não
// este picker). Contactos com 2+ imóveis associados (vendedor, comprador
// candidato ou consultor) passam por um segundo passo a perguntar qual
// imóvel ligar a cada card novo — sem isso o card fica sem imóvel e a
// configuração de "info principal/secundária" (quando é 'property') não
// mostra nada nesse card.
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
  const [step, setStep] = useState<'select' | 'choose-property'>('select')
  const [ambiguous, setAmbiguous] = useState<Ambiguous[]>([])
  const [propertyChoices, setPropertyChoices] = useState<Record<string, string>>({})

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

  async function submitAdd(propertyChoicesBody?: Record<string, string | null>) {
    const res = await fetch(`/api/pipelines/${pipelineId}/add-contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person_ids: [...checked], ...(propertyChoicesBody ? { property_choices: propertyChoicesBody } : {}) }),
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({})) as { added?: number }
      if (typeof data.added === 'number' && data.added < checked.size) {
        alert(`${data.added} de ${checked.size} contacto(s) foram adicionados — os restantes já estavam ativos nesta pipeline.`)
      }
      onAdded()
      onClose()
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string }
      alert(d.error ?? 'Erro ao adicionar contactos.')
    }
  }

  async function confirm() {
    if (checked.size === 0) { onClose(); return }
    setSaving(true)
    try {
      const details = await Promise.all(
        [...checked].map(id => fetch(`/api/people/${id}`).then(r => r.ok ? r.json() as Promise<PersonWithProperties> : null))
      )
      const found = details.filter((p): p is PersonWithProperties => !!p)
      const withAmbiguity = found
        .map(p => ({ id: p.id, name: p.name, properties: candidatesOf(p) }))
        .filter(p => p.properties.length >= 2)

      if (withAmbiguity.length === 0) {
        await submitAdd()
        return
      }
      setAmbiguous(withAmbiguity)
      setPropertyChoices(Object.fromEntries(withAmbiguity.map(p => [p.id, ''])))
      setStep('choose-property')
    } finally {
      setSaving(false)
    }
  }

  async function confirmWithProperties() {
    setSaving(true)
    try {
      const propertyChoicesBody: Record<string, string | null> = {}
      for (const a of ambiguous) propertyChoicesBody[a.id] = propertyChoices[a.id] || null
      await submitAdd(propertyChoicesBody)
    } finally {
      setSaving(false)
    }
  }

  if (step === 'choose-property') {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div className="font-display" style={{ fontSize: 16 }}>Qual imóvel?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Estes contactos têm mais do que um imóvel associado — escolhe qual ligar a cada card novo.</div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ambiguous.map(a => (
              <div key={a.id}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{a.name}</div>
                <select
                  className="input"
                  value={propertyChoices[a.id] ?? ''}
                  onChange={e => setPropertyChoices(prev => ({ ...prev, [a.id]: e.target.value }))}
                >
                  <option value="">Sem imóvel</option>
                  {a.properties.map(p => (
                    <option key={p.id} value={p.id}>{p.reference ? `${p.reference} — ${p.title}` : p.title}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setStep('select')} className="btn btn-ghost" style={{ flex: 1 }}>← Voltar</button>
            <button onClick={confirmWithProperties} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? 'A adicionar…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    )
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
            {saving ? 'A verificar…' : `Adicionar${checked.size > 0 ? ` (${checked.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
