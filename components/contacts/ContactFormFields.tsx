'use client'
import {
  CONTACT_TYPES, CAPACITY_BANDS, CONTACT_SOURCES, SOURCE_LABELS,
  type ContactTypeKey,
} from '@/lib/contacts/constants'
import type { ContactDetails } from '@/types'

export type Member = { id: string; name: string; avatar_initials: string }

type Props = {
  types: ContactTypeKey[]
  onToggleType: (t: ContactTypeKey) => void
  capacity: string
  onCapacityChange: (v: string) => void
  source: string
  onSourceChange: (v: string) => void
  details: ContactDetails
  onDetailChange: <K extends keyof ContactDetails>(k: K, v: ContactDetails[K]) => void
  assignedTo: string
  onAssignedToChange: (v: string) => void
  members: Member[]
  birthday: string
  onBirthdayChange: (v: string) => void
  isRegular: boolean
  onIsRegularChange: (v: boolean) => void
}

const cb = { width: 15, height: 15, accentColor: '#B07D2E', cursor: 'pointer' as const }
const sectionLabel = { fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 6 }

// Campos de contacto partilhados entre "Novo Contacto" (NewContactModal) e
// "Novo Lead" (NewLeadModal, quando não se escolhe uma pessoa já existente
// no autocomplete) — mesmo esquema de campos nos dois sítios.
export function ContactFormFields({
  types, onToggleType, capacity, onCapacityChange, source, onSourceChange,
  details, onDetailChange, assignedTo, onAssignedToChange, members,
  birthday, onBirthdayChange, isRegular, onIsRegularChange,
}: Props) {
  const has = (t: ContactTypeKey) => types.includes(t)

  return (
    <>
      <div>
        <div style={sectionLabel}>Tipo</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CONTACT_TYPES.map(meta => {
            const active = has(meta.key)
            return (
              <button
                key={meta.key}
                type="button"
                onClick={() => onToggleType(meta.key)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  background: active ? `${meta.color}18` : 'var(--surface)',
                  color: active ? meta.color : 'var(--muted)',
                  border: active ? `1px solid ${meta.color}55` : '1px solid var(--border)',
                }}
              >
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {(has('comprador') || has('investidor')) && (
        <div>
          <div style={sectionLabel}>Capacidade financeira</div>
          <select className="input" value={capacity} onChange={e => onCapacityChange(e.target.value)}>
            <option value="">—</option>
            {CAPACITY_BANDS.map(b => (
              <option key={b.key} value={b.key}>{b.label} ({b.range})</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div style={sectionLabel}>Origem</div>
        <select className="input" value={source} onChange={e => onSourceChange(e.target.value)}>
          <option value="">—</option>
          {CONTACT_SOURCES.map(s => (
            <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div>
        <div style={sectionLabel}>Link do anúncio Idealista</div>
        <input
          className="input"
          placeholder="https://www.idealista.pt/imovel/..."
          value={details.idealista_url ?? ''}
          onChange={e => onDetailChange('idealista_url', e.target.value)}
        />
      </div>

      {(has('comprador') || has('investidor')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={sectionLabel}>Procura</div>
          <input className="input" placeholder="O que procura" value={details.looking_for ?? ''} onChange={e => onDetailChange('looking_for', e.target.value)} />
          <input className="input" placeholder="Zona" value={details.search_zone ?? ''} onChange={e => onDetailChange('search_zone', e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" style={cb} checked={!!details.already_bought} onChange={e => onDetailChange('already_bought', e.target.checked)} />
            Já comprou connosco
          </label>
        </div>
      )}

      {(has('vendedor') || has('investidor')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={sectionLabel}>Venda</div>
          <input className="input" placeholder={has('vendedor') ? 'O que vende' : 'O que oferece'} value={details.selling_property ?? ''} onChange={e => onDetailChange('selling_property', e.target.value)} />
          <input className="input" placeholder="Onde vende" value={details.selling_zone ?? ''} onChange={e => onDetailChange('selling_zone', e.target.value)} />
          <input className="input" type="number" placeholder="Preço (€)" value={details.selling_price ?? ''} onChange={e => onDetailChange('selling_price', Number(e.target.value) || undefined)} />
          <input className="input" placeholder="Tipologia" value={details.typology ?? ''} onChange={e => onDetailChange('typology', e.target.value)} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={cb} checked={!!details.has_garage} onChange={e => onDetailChange('has_garage', e.target.checked)} />
              Garagem
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={cb} checked={!!details.has_balcony} onChange={e => onDetailChange('has_balcony', e.target.checked)} />
              Varanda
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={cb} checked={!!details.has_exclusivity} onChange={e => onDetailChange('has_exclusivity', e.target.checked)} />
              Exclusividade
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={cb} checked={!!details.is_active_seller} onChange={e => onDetailChange('is_active_seller', e.target.checked)} />
              Vendedor ativo
            </label>
          </div>
        </div>
      )}

      {has('consultor') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={sectionLabel}>Consultor Imobiliário</div>
          <input className="input" placeholder="Agência" value={details.agency_name ?? ''} onChange={e => onDetailChange('agency_name', e.target.value)} />
          <input className="input" placeholder="Zona de atuação" value={details.working_zone ?? ''} onChange={e => onDetailChange('working_zone', e.target.value)} />
        </div>
      )}

      {has('servico') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={sectionLabel}>Serviço</div>
          <input className="input" placeholder="O que faz (ex: canalizador, eletricista)" value={details.service_type ?? ''} onChange={e => onDetailChange('service_type', e.target.value)} />
          <input className="input" placeholder="Zona de atuação" value={details.working_zone ?? ''} onChange={e => onDetailChange('working_zone', e.target.value)} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={sectionLabel}>Responsável *</div>
          <select className="input" value={assignedTo} onChange={e => onAssignedToChange(e.target.value)} required>
            <option value="" disabled>Escolher…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <div style={sectionLabel}>Nascimento</div>
          <input className="input" type="date" value={birthday} onChange={e => onBirthdayChange(e.target.value)} />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <input type="checkbox" style={cb} checked={isRegular} onChange={e => onIsRegularChange(e.target.checked)} />
        <span>
          <span style={{ fontWeight: 600 }}>Contacto regular</span>
          <span style={{ color: 'var(--muted)', marginLeft: 6 }}>— com follow-ups automáticos</span>
        </span>
      </label>
    </>
  )
}
