'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  CONTACT_TYPES, CAPACITY_BANDS, CONTACT_SOURCES, SOURCE_LABELS,
  type ContactTypeKey,
} from '@/lib/contacts/constants'
import type { ContactDetails, Person } from '@/types'
import { AudioRecorder } from '@/components/shared/AudioRecorder'
import { normalizePhone } from '@/lib/whatsapp/utils'

type Initial = Partial<{
  name: string
  email: string
  phone: string
  types: ContactTypeKey[]
  financial_capacity: string
  source: string
  details: ContactDetails
  notes: string
}>

type Member = { id: string; name: string; avatar_initials: string }

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
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [birthday, setBirthday] = useState('')
  const [isRegular, setIsRegular] = useState(false)
  const [assignedTo, setAssignedTo] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'manual' | 'audio'>('manual')
  const [existing, setExisting] = useState<Person[]>([])

  // Carregar contactos existentes uma vez, para detetar duplicados enquanto se escreve
  useEffect(() => {
    fetch('/api/people')
      .then(r => r.ok ? r.json() : [])
      .then((data: Person[]) => setExisting(data))
      .catch(() => {})
  }, [])

  // Carregar membros da agência e pré-selecionar o utilizador atual como responsável
  useEffect(() => {
    fetch('/api/team/members')
      .then(r => r.ok ? r.json() : { members: [], current_user_id: '' })
      .then((data: { members: Member[]; current_user_id: string }) => {
        setMembers(data.members)
        setAssignedTo(prev => prev || data.current_user_id)
      })
      .catch(() => {})
  }, [])

  const duplicate = useMemo(() => {
    const phoneNorm = phone.trim() ? normalizePhone(phone) : null
    const emailNorm = email.trim().toLowerCase() || null
    if (!phoneNorm && !emailNorm) return null
    return existing.find(p =>
      (phoneNorm && p.phone && normalizePhone(p.phone) === phoneNorm) ||
      (emailNorm && p.email && p.email.toLowerCase() === emailNorm)
    ) ?? null
  }, [existing, phone, email])

  const has = (t: ContactTypeKey) => types.includes(t)
  const toggleType = (t: ContactTypeKey) =>
    setTypes(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))
  const d = (k: keyof ContactDetails, v: unknown) => setDetails(p => ({ ...p, [k]: v }))

  function applyExtracted(f: Record<string, unknown>) {
    if (typeof f.name === 'string') setName(f.name)
    if (typeof f.phone === 'string') setPhone(f.phone)
    if (typeof f.email === 'string') setEmail(f.email)
    if (Array.isArray(f.types)) setTypes(f.types as ContactTypeKey[])
    if (typeof f.financial_capacity === 'string') setCapacity(f.financial_capacity)
    setSource('audio')
    if (f.details && typeof f.details === 'object') setDetails(f.details as ContactDetails)
    if (typeof f.notes === 'string') setNotes(f.notes)
    if (typeof f.birthday === 'string') setBirthday(f.birthday)
    if (typeof f.is_regular === 'boolean') setIsRegular(f.is_regular)
    setMode('manual')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, phone, types,
          financial_capacity: (types.includes('comprador') || types.includes('investidor')) ? (capacity || null) : null,
          source, details, notes: notes || null,
          birthday: birthday || null,
          is_regular: isRegular,
          assigned_to: assignedTo || null,
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
      <div className="modal" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Cabeçalho fixo: título + seletor de modo (sempre visível) */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="font-display" style={{ fontSize: 18 }}>Novo Contacto</div>
            <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['manual', 'audio'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: mode === m ? 'var(--gold-glow)' : 'var(--surface)',
                  color: mode === m ? 'var(--gold)' : 'var(--muted)',
                  border: mode === m ? '1px solid var(--gold)' : '1px solid var(--border)',
                }}
              >
                {m === 'manual' ? '✍ Manual' : '🎙 Áudio'}
              </button>
            ))}
          </div>
        </div>

        {/* Corpo com scroll próprio (minHeight:0 permite ao flex encolher e ativar o scroll) */}
        <div style={{ padding: '16px 24px 20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {mode === 'audio' && <AudioRecorder entity="contact" onExtracted={applyExtracted} />}

        {mode === 'manual' && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="input" placeholder="Nome *" value={name} onChange={e => setName(e.target.value)} required />
          <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="input" placeholder="Telefone" value={phone} onChange={e => setPhone(e.target.value)} />

          {duplicate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#B45309' }}>
              <span>⚠</span>
              <span style={{ flex: 1 }}>Já existe um contacto com este {duplicate.phone && phone && normalizePhone(duplicate.phone) === normalizePhone(phone) ? 'telefone' : 'email'}: <strong>{duplicate.name}</strong></span>
              <a href={`/people/${duplicate.id}`} style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>Ver ficha →</a>
            </div>
          )}

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

          {(has('comprador') || has('investidor')) && (
            <div>
              <div style={sectionLabel}>Capacidade financeira</div>
              <select className="input" value={capacity} onChange={e => setCapacity(e.target.value)}>
                <option value="">—</option>
                {CAPACITY_BANDS.map(b => (
                  <option key={b.key} value={b.key}>{b.label} ({b.range})</option>
                ))}
              </select>
            </div>
          )}

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
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" style={cb} checked={!!details.already_bought} onChange={e => d('already_bought', e.target.checked)} />
                Já comprou connosco
              </label>
            </div>
          )}

          {(has('vendedor') || has('investidor')) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={sectionLabel}>Venda</div>
              <input className="input" placeholder={has('vendedor') ? 'O que vende' : 'O que oferece'} value={details.selling_property ?? ''} onChange={e => d('selling_property', e.target.value)} />
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

          {has('consultor') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={sectionLabel}>Consultor Imobiliário</div>
              <input className="input" placeholder="Agência" value={details.agency_name ?? ''} onChange={e => d('agency_name', e.target.value)} />
              <input className="input" placeholder="Zona de atuação" value={details.working_zone ?? ''} onChange={e => d('working_zone', e.target.value)} />
            </div>
          )}

          {has('servico') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={sectionLabel}>Serviço</div>
              <input className="input" placeholder="O que faz (ex: canalizador, eletricista)" value={details.service_type ?? ''} onChange={e => d('service_type', e.target.value)} />
              <input className="input" placeholder="Zona de atuação" value={details.working_zone ?? ''} onChange={e => d('working_zone', e.target.value)} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={sectionLabel}>Responsável *</div>
              <select className="input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} required>
                <option value="" disabled>Escolher…</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <div style={sectionLabel}>Nascimento</div>
              <input className="input" type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <input type="checkbox" style={cb} checked={isRegular} onChange={e => setIsRegular(e.target.checked)} />
            <span>
              <span style={{ fontWeight: 600 }}>Contacto regular</span>
              <span style={{ color: 'var(--muted)', marginLeft: 6 }}>— com follow-ups automáticos</span>
            </span>
          </label>

          <div>
            <div style={sectionLabel}>Notas</div>
            <textarea
              className="input"
              placeholder="Contexto adicional: familiares, profissão, motivo da venda/compra, preferências..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'A criar...' : 'Criar'}</button>
          </div>
        </form>
        )}
        </div>
      </div>
    </div>
  )
}
