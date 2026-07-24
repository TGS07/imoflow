'use client'
import { useState, useEffect, useMemo } from 'react'
import { type ContactTypeKey } from '@/lib/contacts/constants'
import { ContactFormFields, type Member } from '@/components/contacts/ContactFormFields'
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

  const toggleType = (t: ContactTypeKey) =>
    setTypes(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))
  const setDetail = <K extends keyof ContactDetails>(k: K, v: ContactDetails[K]) =>
    setDetails(p => ({ ...p, [k]: v }))

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

          <ContactFormFields
            types={types} onToggleType={toggleType}
            capacity={capacity} onCapacityChange={setCapacity}
            source={source} onSourceChange={setSource}
            details={details} onDetailChange={setDetail}
            assignedTo={assignedTo} onAssignedToChange={setAssignedTo} members={members}
            birthday={birthday} onBirthdayChange={setBirthday}
            isRegular={isRegular} onIsRegularChange={setIsRegular}
          />

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
