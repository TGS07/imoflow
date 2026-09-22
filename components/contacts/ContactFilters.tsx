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

const heading: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--muted)', fontWeight: 700, marginBottom: 2,
}

const checkBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '5px 12px 5px 8px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'transparent',
  cursor: 'pointer', transition: 'all 0.15s ease',
  fontFamily: 'inherit', color: 'var(--text)', fontSize: 12, fontWeight: 500,
}

const checkActive: React.CSSProperties = {
  ...checkBase,
  borderColor: 'var(--gold)', background: 'var(--gold-glow)',
}

const boxBase: React.CSSProperties = {
  width: 16, height: 16, borderRadius: 4,
  border: '1.5px solid var(--border-strong)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, transition: 'all 0.15s ease', background: 'transparent',
}

const boxActive: React.CSSProperties = {
  ...boxBase,
  background: 'var(--gold)', borderColor: 'var(--gold)', color: '#0D0D0F',
}

function Check({ checked, onChange, label, sub }: { checked: boolean; onChange: () => void; label: string; sub?: string }) {
  return (
    <button type="button" onClick={onChange} style={checked ? checkActive : checkBase}>
      <span style={checked ? boxActive : boxBase}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      <span>{label}</span>
      {sub && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</span>}
    </button>
  )
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

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: 20, marginBottom: 20,
    }}>
      {/* Capacidade financeira */}
      <div>
        <div style={heading}>Capacidade financeira</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {CAPACITY_BANDS.map(b => (
            <Check key={b.key} checked={value.capacities.includes(b.key)} onChange={() => toggleArr('capacities', b.key)} label={b.label} sub={b.range} />
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

      {/* Acompanhamento */}
      <div>
        <div style={heading}>Acompanhamento</div>
        <div style={{ marginTop: 8 }}>
          <Check checked={value.onlyRegular} onChange={() => toggleBool('onlyRegular')} label="Só contactos regulares" />
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

      {/* Imóvel / negócio */}
      <div>
        <div style={heading}>Imóvel / negócio</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {([
            ['hasGarage','Tem garagem'], ['hasBalcony','Tem varanda'],
            ['hasExclusivity','Exclusividade'], ['activeSeller','Vendedor ativo'],
            ['alreadyBought','Já comprou'],
          ] as [keyof ContactFilterState, string][]).map(([key, label]) => (
            <Check key={key} checked={value[key] as boolean} onChange={() => toggleBool(key)} label={label} />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)',
      }}>
        <button className="btn btn-ghost" onClick={() => onChange(EMPTY_FILTERS)} style={{ fontSize: 12, padding: '6px 16px' }}>Limpar</button>
        <button className="btn btn-primary" onClick={onClose} style={{ fontSize: 12, padding: '6px 20px' }}>Aplicar</button>
      </div>
    </div>
  )
}
