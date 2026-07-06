'use client'
import { useState } from 'react'
import {
  CONTACT_TYPES, CAPACITY_BANDS, CONTACT_SOURCES, SOURCE_LABELS,
  type ContactTypeKey,
} from '@/lib/contacts/constants'
import type { ContactDetails } from '@/types'

type Initial = Partial<{
  name: string
  email: string
  phone: string
  types: ContactTypeKey[]
  financial_capacity: string
  source: string
  details: ContactDetails
}>

export function NewContactModal({ initial, onClose, onCreated }: {
  initial?: Initial
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [types, setTypes] = useState<ContactTypeKey[]>(initial?.types ?? [])
  const [capacity, setCapacity] = useState(initial?.financial_capacity ?? '')
  const [source, setSource] = useState(initial?.source ?? '')
  const [details, setDetails] = useState<ContactDetails>(initial?.details ?? {})
  const [saving, setSaving] = useState(false)

  const has = (t: ContactTypeKey) => types.includes(t)
  const toggleType = (t: ContactTypeKey) =>
    setTypes(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))
  const d = (k: keyof ContactDetails, v: unknown) => setDetails(p => ({ ...p, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, phone, types,
          financial_capacity: capacity || null,
          source, details,
        }),
      })
      if (res.ok) { onCreated(); onClose() }
    } finally {
      setSaving(false)
    }
  }

  const cb = { width: 15, height: 15, accentColor: '#B07D2E', cursor: 'pointer' as const }
  const sectionLabel = { fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 6 }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 480, maxHeight: '86vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div className="font-display" style={{ fontSize: 18 }}>Novo Contacto</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="input" placeholder="Nome *" value={name} onChange={e => setName(e.target.value)} required />
          <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="input" placeholder="Telefone" value={phone} onChange={e => setPhone(e.target.value)} />

          <div>
            <div style={sectionLabel}>Tipo</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CONTACT_TYPES.map(meta => {
                const active = has(meta.key)
                return (
                  <button
                    key={meta.key}
                    type="button"
                    onClick={() => toggleType(meta.key)}
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

          <div>
            <div style={sectionLabel}>Capacidade financeira</div>
            <select className="input" value={capacity} onChange={e => setCapacity(e.target.value)}>
              <option value="">—</option>
              {CAPACITY_BANDS.map(b => (
                <option key={b.key} value={b.key}>{b.label} ({b.range})</option>
              ))}
            </select>
          </div>

          <div>
            <div style={sectionLabel}>Origem</div>
            <select className="input" value={source} onChange={e => setSource(e.target.value)}>
              <option value="">—</option>
              {CONTACT_SOURCES.map(s => (
                <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {(has('comprador') || has('investidor')) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={sectionLabel}>Procura</div>
              <input className="input" placeholder="O que procura" value={details.looking_for ?? ''} onChange={e => d('looking_for', e.target.value)} />
              <input className="input" placeholder="Zona" value={details.search_zone ?? ''} onChange={e => d('search_zone', e.target.value)} />
              <select className="input" value={details.temperature ?? ''} onChange={e => d('temperature', e.target.value || undefined)}>
                <option value="">Temperatura —</option>
                <option value="quente">Quente</option>
                <option value="morno">Morno</option>
                <option value="frio">Frio</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" style={cb} checked={!!details.already_bought} onChange={e => d('already_bought', e.target.checked)} />
                Já comprou connosco
              </label>
            </div>
          )}

          {has('vendedor') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={sectionLabel}>Venda</div>
              <input className="input" placeholder="O que vende" value={details.selling_property ?? ''} onChange={e => d('selling_property', e.target.value)} />
              <input className="input" placeholder="Onde vende" value={details.selling_zone ?? ''} onChange={e => d('selling_zone', e.target.value)} />
              <input className="input" type="number" placeholder="Preço (€)" value={details.selling_price ?? ''} onChange={e => d('selling_price', Number(e.target.value) || undefined)} />
              <input className="input" placeholder="Tipologia" value={details.typology ?? ''} onChange={e => d('typology', e.target.value)} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" style={cb} checked={!!details.has_garage} onChange={e => d('has_garage', e.target.checked)} />
                  Garagem
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" style={cb} checked={!!details.has_balcony} onChange={e => d('has_balcony', e.target.checked)} />
                  Varanda
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" style={cb} checked={!!details.has_exclusivity} onChange={e => d('has_exclusivity', e.target.checked)} />
                  Exclusividade
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" style={cb} checked={!!details.is_active_seller} onChange={e => d('is_active_seller', e.target.checked)} />
                  Vendedor ativo
                </label>
              </div>
            </div>
          )}

          {has('servico') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={sectionLabel}>Serviço</div>
              <input className="input" placeholder="Tipo de serviço" value={details.service_type ?? ''} onChange={e => d('service_type', e.target.value)} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'A criar...' : 'Criar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
