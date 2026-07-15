'use client'
import { CAPACITY_BANDS } from '@/lib/contacts/constants'
import type { Person } from '@/types'

export type ContactFilterState = {
  capacities: string[]
  sources: string[]
  onlyRegular: boolean
  hasGarage: boolean
  hasBalcony: boolean
  hasExclusivity: boolean
  activeSeller: boolean
  alreadyBought: boolean
}

export const EMPTY_FILTERS: ContactFilterState = {
  capacities: [], sources: [], onlyRegular: false,
  hasGarage: false, hasBalcony: false, hasExclusivity: false,
  activeSeller: false, alreadyBought: false,
}

export function applyContactFilters(people: Person[], f: ContactFilterState): Person[] {
  return people.filter(p => {
    if (f.capacities.length && !f.capacities.includes(p.financial_capacity ?? '')) return false
    if (f.sources.length && !f.sources.includes(p.source ?? '')) return false
    if (f.onlyRegular && !p.is_regular) return false
    if (f.hasGarage && !p.details?.has_garage) return false
    if (f.hasBalcony && !p.details?.has_balcony) return false
    if (f.hasExclusivity && !p.details?.has_exclusivity) return false
    if (f.activeSeller && !p.details?.is_active_seller) return false
    if (f.alreadyBought && !p.details?.already_bought) return false
    return true
  })
}

export function ContactFilters({ value, onChange, onClose }: {
  value: ContactFilterState
  onChange: (f: ContactFilterState) => void
  onClose: () => void
}) {
  const toggleArr = (key: 'capacities' | 'sources', v: string) => {
    const arr = value[key].includes(v) ? value[key].filter(x => x !== v) : [...value[key], v]
    onChange({ ...value, [key]: arr })
  }
  const toggleBool = (key: keyof ContactFilterState) => onChange({ ...value, [key]: !value[key] })
  const cb = { width: 15, height: 15, accentColor: '#B07D2E', cursor: 'pointer' as const }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Capacidade financeira</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {CAPACITY_BANDS.map(b => (
            <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={cb} checked={value.capacities.includes(b.key)} onChange={() => toggleArr('capacities', b.key)} />
              {b.label} <span style={{ color: 'var(--muted)' }}>({b.range})</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Acompanhamento</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" style={cb} checked={value.onlyRegular} onChange={() => toggleBool('onlyRegular')} />
          Só contactos regulares
        </label>
      </div>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Imóvel / negócio</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {([
            ['hasGarage','Tem garagem'], ['hasBalcony','Tem varanda'],
            ['hasExclusivity','Exclusividade'], ['activeSeller','Vendedor ativo'],
            ['alreadyBought','Já comprou'],
          ] as [keyof ContactFilterState, string][]).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={cb} checked={value[key] as boolean} onChange={() => toggleBool(key)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={() => onChange(EMPTY_FILTERS)} style={{ fontSize: 12 }}>Limpar</button>
        <button className="btn btn-primary" onClick={onClose} style={{ fontSize: 12 }}>Aplicar</button>
      </div>
    </div>
  )
}
