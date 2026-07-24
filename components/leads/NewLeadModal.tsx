'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { LeadSource, CustomField, Person, Organization, Property, Pipeline, ContactDetails } from '@/types'
import { AudioRecorder } from '@/components/shared/AudioRecorder'
import { ContactFormFields, type Member } from '@/components/contacts/ContactFormFields'
import type { ContactTypeKey } from '@/lib/contacts/constants'
import { normalizePhone } from '@/lib/whatsapp/utils'

type Props = {
  onClose: () => void
  onCreated: () => void
  initialPerson?: Person
  initialValues?: Partial<{ zone: string; typology: string; budget: number }>
  defaultPipelineIds?: string[]
}

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'site', label: '🌐 Site' },
  { value: 'instagram', label: '📱 Instagram' },
  { value: 'facebook', label: '📘 Facebook' },
  { value: 'referencia', label: '👤 Referência' },
  { value: 'outro', label: '◯ Outro' },
]

export function NewLeadModal({ onClose, onCreated, initialPerson, initialValues, defaultPipelineIds }: Props) {
  const [form, setForm] = useState({
    name: initialPerson?.name ?? '',
    email: initialPerson?.email ?? '',
    phone: initialPerson?.phone ?? '',
    source: 'site' as LeadSource,
    zone: initialValues?.zone ?? '',
    typology: initialValues?.typology ?? '',
    budget: initialValues?.budget != null ? String(initialValues.budget) : '',
    deal_value: '',
    expected_close_date: '',
    notes: '',
  })
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'manual' | 'audio'>('manual')

  // Campos de contacto — só usados para criar uma pessoa nova (quando
  // nenhuma pessoa é escolhida no autocomplete "Pessoa" abaixo). Mesmos
  // campos que o NewContactModal, via ContactFormFields.
  const [contactTypes, setContactTypes] = useState<ContactTypeKey[]>([])
  const [capacity, setCapacity] = useState('')
  const [contactSource, setContactSource] = useState('')
  const [details, setDetails] = useState<ContactDetails>({})
  const [assignedTo, setAssignedTo] = useState('')
  const [birthday, setBirthday] = useState('')
  const [isRegular, setIsRegular] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  // Pessoa criada durante esta sessão do modal — evita duplicar o contacto
  // se uma tentativa anterior de submissão falhar a meio (ex: erro ao criar
  // uma das leads) e o utilizador tentar submeter outra vez.
  const [createdPersonId, setCreatedPersonId] = useState<string | null>(null)
  // Contactos existentes, para detetar duplicados enquanto se escreve (mesmo
  // padrão do NewContactModal.tsx).
  const [existing, setExisting] = useState<Person[]>([])

  const toggleContactType = (t: ContactTypeKey) =>
    setContactTypes(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))
  const setDetail = <K extends keyof ContactDetails>(k: K, v: ContactDetails[K]) =>
    setDetails(p => ({ ...p, [k]: v }))

  // Pipelines — seleção múltipla; cria uma lead por pipeline marcada.
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [pipelineIds, setPipelineIds] = useState<string[]>(defaultPipelineIds ?? [])
  const togglePipeline = (pid: string) =>
    setPipelineIds(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid])

  function applyVoice(f: Record<string, unknown>) {
    setForm(p => ({
      ...p,
      name: typeof f.name === 'string' ? f.name : p.name,
      email: typeof f.email === 'string' ? f.email : p.email,
      phone: typeof f.phone === 'string' ? f.phone : p.phone,
      zone: typeof f.zone === 'string' ? f.zone : p.zone,
      typology: typeof f.typology === 'string' ? f.typology : p.typology,
      budget: typeof f.budget === 'number' ? String(f.budget) : p.budget,
      notes: typeof f.notes === 'string' ? f.notes : p.notes,
    }))
    setMode('manual')
  }

  // Person autocomplete
  const [personSearch, setPersonSearch] = useState(initialPerson?.name ?? '')
  const [personResults, setPersonResults] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(initialPerson ?? null)
  const [showPersonDropdown, setShowPersonDropdown] = useState(false)
  const personRef = useRef<HTMLDivElement>(null)

  // Organization autocomplete
  const [orgSearch, setOrgSearch] = useState('')
  const [orgResults, setOrgResults] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [showOrgDropdown, setShowOrgDropdown] = useState(false)
  const orgRef = useRef<HTMLDivElement>(null)

  // Property autocomplete
  const [propSearch, setPropSearch] = useState('')
  const [propResults, setPropResults] = useState<Property[]>([])
  const [selectedProp, setSelectedProp] = useState<Property | null>(null)
  const [showPropDropdown, setShowPropDropdown] = useState(false)
  const propRef = useRef<HTMLDivElement>(null)

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-body)' }
  const labelStyle = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 5 }

  useEffect(() => {
    fetch('/api/custom-fields').then(r => r.json()).then(setCustomFields)
  }, [])

  useEffect(() => {
    fetch('/api/team/members')
      .then(r => r.ok ? r.json() : { members: [], current_user_id: '' })
      .then((data: { members: Member[]; current_user_id: string }) => {
        setMembers(data.members)
        setAssignedTo(prev => prev || data.current_user_id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/pipelines')
      .then(r => r.ok ? r.json() : [])
      .then((data: Pipeline[]) => {
        setPipelines(data)
        setPipelineIds(prev => prev.length > 0 ? prev : (data[0] ? [data[0].id] : []))
      })
      .catch(() => {})
  }, [])

  // Carregar contactos existentes uma vez, para detetar duplicados enquanto
  // se preenche o formulário de contacto novo (mesmo padrão do NewContactModal).
  useEffect(() => {
    fetch('/api/people')
      .then(r => r.ok ? r.json() : [])
      .then((data: Person[]) => setExisting(data))
      .catch(() => {})
  }, [])

  // Só relevante quando não se escolheu uma pessoa existente no autocomplete
  // — se já houver `selectedPerson`, não se vai criar um contacto novo.
  const duplicate = useMemo(() => {
    if (selectedPerson) return null
    const phoneNorm = form.phone.trim() ? normalizePhone(form.phone) : null
    const emailNorm = form.email.trim().toLowerCase() || null
    if (!phoneNorm && !emailNorm) return null
    return existing.find(p =>
      (phoneNorm && p.phone && normalizePhone(p.phone) === phoneNorm) ||
      (emailNorm && p.email && p.email.toLowerCase() === emailNorm)
    ) ?? null
  }, [existing, form.phone, form.email, selectedPerson])

  // Person search
  useEffect(() => {
    if (!personSearch || selectedPerson) { setPersonResults([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/people?search=${encodeURIComponent(personSearch)}`)
      if (res.ok) setPersonResults(await res.json())
    }, 300)
    return () => clearTimeout(timer)
  }, [personSearch, selectedPerson])

  // Organization search
  useEffect(() => {
    if (!orgSearch || selectedOrg) { setOrgResults([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/organizations?search=${encodeURIComponent(orgSearch)}`)
      if (res.ok) setOrgResults(await res.json())
    }, 300)
    return () => clearTimeout(timer)
  }, [orgSearch, selectedOrg])

  // Property search
  useEffect(() => {
    if (!propSearch || selectedProp) { setPropResults([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/properties?search=${encodeURIComponent(propSearch)}`)
      if (res.ok) setPropResults(await res.json())
    }, 300)
    return () => clearTimeout(timer)
  }, [propSearch, selectedProp])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (personRef.current && !personRef.current.contains(e.target as Node)) setShowPersonDropdown(false)
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setShowOrgDropdown(false)
      if (propRef.current && !propRef.current.contains(e.target as Node)) setShowPropDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pipelineIds.length === 0) return
    setLoading(true)
    try {
      const cfValues: Record<string, string | number | null> = {}
      for (const field of customFields) {
        const raw = customValues[field.id]
        if (!raw && field.required) return
        if (!raw) continue
        if (field.field_type === 'number' || field.field_type === 'currency') {
          cfValues[field.id] = Number(raw)
        } else {
          cfValues[field.id] = raw
        }
      }

      // Pessoa: usa a escolhida no autocomplete, ou a criada numa tentativa
      // anterior desta mesma sessão do modal (evita duplicar o contacto se
      // uma submissão anterior falhar a meio, ex: erro ao criar uma lead),
      // ou cria uma nova com todos os campos de ContactFormFields preenchidos.
      let personId = selectedPerson?.id ?? createdPersonId
      if (!personId) {
        const personRes = await fetch('/api/people', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email || null,
            phone: form.phone || null,
            types: contactTypes,
            financial_capacity: (contactTypes.includes('comprador') || contactTypes.includes('investidor')) ? (capacity || null) : null,
            source: contactSource || null,
            details,
            notes: form.notes || null,
            birthday: birthday || null,
            is_regular: isRegular,
            assigned_to: assignedTo || null,
          }),
        })
        if (!personRes.ok) throw new Error('Erro ao criar contacto')
        const createdPerson = await personRes.json() as { id: string }
        personId = createdPerson.id
        setCreatedPersonId(personId)
      }

      // Uma lead por pipeline marcada, todas ligadas à mesma pessoa/imóvel.
      const createdLeadIds: string[] = []
      for (const pipelineId of pipelineIds) {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email || null,
            phone: form.phone || null,
            source: form.source,
            zone: form.zone || null,
            typology: form.typology || null,
            budget: form.budget ? Number(form.budget) : null,
            deal_value: form.deal_value ? Number(form.deal_value) : null,
            expected_close_date: form.expected_close_date || null,
            notes: form.notes || null,
            person_id: personId,
            organization_id: selectedOrg?.id ?? null,
            property_id: selectedProp?.id ?? null,
            pipeline_id: pipelineId,
            custom_fields: Object.keys(cfValues).length > 0 ? cfValues : undefined,
          }),
        })
        if (!res.ok) throw new Error('Erro ao criar lead')
        const created = await res.json() as { id?: string }
        if (created?.id) createdLeadIds.push(created.id)
      }

      for (const leadId of createdLeadIds) {
        fetch('/api/ai/qualify-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: leadId }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(async (q: { score: number } | null) => {
            if (!q) return
            await fetch(`/api/leads/${leadId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ score: q.score }),
            })
          })
          .catch(() => {})
      }

      onCreated()
      onClose()
    } catch {
      // keep modal open on error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="font-display" style={{ fontSize: 18 }}>Novo Lead</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['manual', 'audio'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: mode === m ? 'var(--gold-glow)' : 'var(--surface)',
                color: mode === m ? 'var(--gold)' : 'var(--muted)',
                border: mode === m ? '1px solid var(--gold)' : '1px solid var(--border)',
              }}
            >
              {m === 'manual' ? '✍ Manual' : '🎙 Áudio'}
            </button>
          ))}
        </div>

        {mode === 'audio' && <AudioRecorder entity="lead" onExtracted={applyVoice} hint="Descreve o lead em voz alta (nome, contacto, zona, tipologia, orçamento e qualquer contexto extra) e confirma os dados a seguir." />}

        {mode === 'manual' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Person autocomplete */}
          <div ref={personRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Pessoa</label>
            {selectedPerson ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...inputStyle, background: 'var(--card)' }}>
                <span style={{ fontSize: 13, flex: 1 }}>{selectedPerson.name}</span>
                <button type="button" onClick={() => { setSelectedPerson(null); setPersonSearch(''); setForm(f => ({ ...f, name: '', email: '', phone: '' })) }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            ) : (
              <input style={inputStyle} placeholder="Pesquisar pessoa..." value={personSearch} onChange={e => { setPersonSearch(e.target.value); setShowPersonDropdown(true) }} onFocus={() => setShowPersonDropdown(true)} />
            )}
            {showPersonDropdown && personSearch && !selectedPerson && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: 'auto', zIndex: 10 }}>
                {personResults.map(p => (
                  <div key={p.id} onClick={() => { setSelectedPerson(p); setPersonSearch(p.name); setShowPersonDropdown(false); setForm(f => ({ ...f, name: p.name, email: f.email || p.email || '', phone: f.phone || p.phone || '' })) }} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {p.email && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.email}</div>}
                  </div>
                ))}
                {personResults.length === 0 && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>Nenhuma pessoa encontrada</div>}
              </div>
            )}
          </div>

          {/* Organization autocomplete */}
          <div ref={orgRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Organização</label>
            {selectedOrg ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...inputStyle, background: 'var(--card)' }}>
                <span style={{ fontSize: 13, flex: 1 }}>{selectedOrg.name}</span>
                <button type="button" onClick={() => { setSelectedOrg(null); setOrgSearch('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            ) : (
              <input style={inputStyle} placeholder="Pesquisar organização..." value={orgSearch} onChange={e => { setOrgSearch(e.target.value); setShowOrgDropdown(true) }} onFocus={() => setShowOrgDropdown(true)} />
            )}
            {showOrgDropdown && orgSearch && !selectedOrg && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: 'auto', zIndex: 10 }}>
                {orgResults.map(o => (
                  <div key={o.id} onClick={() => { setSelectedOrg(o); setOrgSearch(o.name); setShowOrgDropdown(false) }} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 500 }}>{o.name}</div>
                  </div>
                ))}
                {orgResults.length === 0 && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>Nenhuma organização encontrada</div>}
              </div>
            )}
          </div>

          {/* Property autocomplete */}
          <div ref={propRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Imóvel</label>
            {selectedProp ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...inputStyle, background: 'var(--card)' }}>
                <span style={{ fontSize: 13, flex: 1 }}>{selectedProp.reference ? `${selectedProp.reference} — ` : ''}{selectedProp.title}</span>
                <button type="button" onClick={() => { setSelectedProp(null); setPropSearch('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            ) : (
              <input style={inputStyle} placeholder="Pesquisar imóvel..." value={propSearch} onChange={e => { setPropSearch(e.target.value); setShowPropDropdown(true) }} onFocus={() => setShowPropDropdown(true)} />
            )}
            {showPropDropdown && propSearch && !selectedProp && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: 'auto', zIndex: 10 }}>
                {propResults.map(p => (
                  <div key={p.id} onClick={() => { setSelectedProp(p); setPropSearch(p.title); setShowPropDropdown(false) }} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 500 }}>{p.reference ? `${p.reference} — ` : ''}{p.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.price ? `€${p.price.toLocaleString('pt-PT')}` : ''} {p.zone ?? ''}</div>
                  </div>
                ))}
                {propResults.length === 0 && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>Nenhum imóvel encontrado</div>}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Nome *</label>
            <input
              style={{ ...inputStyle, ...(selectedPerson ? { background: 'var(--card)', color: 'var(--muted)' } : {}) }}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              disabled={!!selectedPerson}
              title={selectedPerson ? 'Nome do contacto ligado — edita-se na ficha do contacto' : undefined}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><label style={labelStyle}>Telefone</label><input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          </div>

          {!selectedPerson && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600 }}>Contacto</div>

              {duplicate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#B45309' }}>
                  <span>⚠</span>
                  <span style={{ flex: 1 }}>Já existe um contacto com este {duplicate.phone && form.phone && normalizePhone(duplicate.phone) === normalizePhone(form.phone) ? 'telefone' : 'email'}: <strong>{duplicate.name}</strong></span>
                  <a href={`/people/${duplicate.id}`} style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>Ver ficha →</a>
                </div>
              )}

              <ContactFormFields
                types={contactTypes} onToggleType={toggleContactType}
                capacity={capacity} onCapacityChange={setCapacity}
                source={contactSource} onSourceChange={setContactSource}
                details={details} onDetailChange={setDetail}
                assignedTo={assignedTo} onAssignedToChange={setAssignedTo} members={members}
                birthday={birthday} onBirthdayChange={setBirthday}
                isRegular={isRegular} onIsRegularChange={setIsRegular}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Zona</label><input style={inputStyle} value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} placeholder="Ex: Cascais" /></div>
            <div><label style={labelStyle}>Tipologia</label><input style={inputStyle} value={form.typology} onChange={e => setForm(p => ({ ...p, typology: e.target.value }))} placeholder="Ex: T3" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Orçamento (€)</label><input type="number" style={inputStyle} value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="Ex: 350000" /></div>
            <div>
              <label style={labelStyle}>Origem do negócio</label>
              <select style={{ ...inputStyle }} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value as LeadSource }))}>
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notas</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical' as const }}
              placeholder="Contexto adicional: familiares, profissão, motivo, preferências..."
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10, fontWeight: 600 }}>Negócio</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Valor do Negócio (€)</label><input type="number" style={inputStyle} value={form.deal_value} onChange={e => setForm(p => ({ ...p, deal_value: e.target.value }))} placeholder="Ex: 15000" /></div>
              <div><label style={labelStyle}>Data Prevista de Fecho</label><input type="date" style={inputStyle} value={form.expected_close_date} onChange={e => setForm(p => ({ ...p, expected_close_date: e.target.value }))} /></div>
            </div>
          </div>

          {customFields.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10, fontWeight: 600 }}>Campos Personalizados</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {customFields.map(field => (
                  <div key={field.id}>
                    <label style={labelStyle}>{field.name}{field.required ? ' *' : ''}</label>
                    {field.field_type === 'select' ? (
                      <select
                        style={inputStyle}
                        value={customValues[field.id] ?? ''}
                        onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                        required={field.required}
                      >
                        <option value="">Selecionar...</option>
                        {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.field_type === 'boolean' ? (
                      <select
                        style={inputStyle}
                        value={customValues[field.id] ?? ''}
                        onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                      >
                        <option value="">—</option>
                        <option value="true">Sim</option>
                        <option value="false">Nao</option>
                      </select>
                    ) : (
                      <input
                        type={field.field_type === 'number' || field.field_type === 'currency' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                        style={inputStyle}
                        value={customValues[field.id] ?? ''}
                        onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10, fontWeight: 600 }}>Pipelines</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {pipelines.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: pipelineIds.includes(p.id) ? 'var(--gold-glow)' : 'var(--surface)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={pipelineIds.includes(p.id)} onChange={() => togglePipeline(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
            {pipelineIds.length === 0 && <div style={{ fontSize: 11, color: '#B45309', marginTop: 6 }}>Marca pelo menos uma pipeline.</div>}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={loading || pipelineIds.length === 0} className="btn btn-primary" style={{ flex: 1 }}>
              {loading ? 'A criar...' : 'Criar Lead'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
