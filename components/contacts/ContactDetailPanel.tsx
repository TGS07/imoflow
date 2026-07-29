'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Person } from '@/types'
import type { ContactDetails, ContactSpecialDate } from '@/types'
import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'
import { InteractionTimeline } from '@/components/contacts/InteractionTimeline'
import { CONTACT_TYPES, CAPACITY_BANDS, capacityMeta, type ContactTypeKey } from '@/lib/contacts/constants'
import { formatPhoneDisplay, normalizePhone } from '@/lib/whatsapp/utils'
import { ContactAiSuggestion } from '@/components/contacts/ContactAiSuggestion'
import { ContactIdealistaPreferences } from '@/components/contacts/ContactIdealistaPreferences'
import { SellerProperties } from '@/components/contacts/SellerProperties'
import { ConsultantProperties } from '@/components/contacts/ConsultantProperties'
import { REGULAR_INTERVAL_PRESETS } from '@/lib/contacts/special-dates'

export type LeadSummary = {
  id: string
  name: string
  stage_id: string
  pipeline_id: string | null
  deal_value: number | null
  expected_close_date: string | null
  created_at: string
  pipeline_stages?: { name: string; color: string; is_won: boolean; is_lost: boolean }
  pipelines?: { name: string } | null
  stage_recurring_days?: number | null
}

type PropertyRef = { id: string; title: string; status: string; price: number | null; reference: string | null }

type PersonDetail = Person & {
  leads?: LeadSummary[]
  properties_as_seller?: PropertyRef[]
  properties_as_buyer?: PropertyRef[]
  property_consultants?: { id: string; properties: PropertyRef }[]
}

export type ContactDetailPanelProps = {
  personId: string
  embedded?: boolean          // true = dentro do slide-over da pipeline
  onClose?: () => void        // fechar o slide-over
  onChanged?: () => void      // avisar o board que dados mudaram
  highlightLeadId?: string    // lead que originou a abertura (realce)
}

export function ContactDetailPanel({ personId, embedded = false, onClose, onChanged, highlightLeadId }: ContactDetailPanelProps) {
  const id = personId
  const router = useRouter()
  const [person, setPerson] = useState<PersonDetail | null>(null)
  const [editing, setEditing] = useState(false)
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [pipelineBusy, setPipelineBusy] = useState(false)
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([])
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, { id: string; name: string; is_won: boolean; is_lost: boolean }[]>>({})
  const [pipelineMenuOpen, setPipelineMenuOpen] = useState(false)
  const [pipelineSelection, setPipelineSelection] = useState<string[]>([])
  const [propertyChoice, setPropertyChoice] = useState('')
  const pipelineMenuRef = useRef<HTMLDivElement>(null)
  const [customInterval, setCustomInterval] = useState('')
  const [agencyFollowup, setAgencyFollowup] = useState<{ first: number; second: number } | null>(null)
  const [newSpecialDate, setNewSpecialDate] = useState({ label: '', month: '', day: '' })
  const [form, setForm] = useState<{
    name: string; email: string; phone: string; address: string; notes: string
    types: ContactTypeKey[]; financial_capacity: string; source: string; details: ContactDetails
    assigned_to: string; is_regular: boolean; birthday: string
  }>({ name: '', email: '', phone: '', address: '', notes: '', types: [], financial_capacity: '', source: '', details: {}, assigned_to: '', is_regular: false, birthday: '' })

  const fetchPerson = useCallback(async () => {
    const res = await fetch(`/api/people/${id}`)
    if (!res.ok) return
    const data = await res.json()
    setPerson(data)
    setForm({
      name: data.name, email: data.email ?? '', phone: data.phone ?? '', address: data.address ?? '', notes: data.notes ?? '',
      types: data.types ?? [], financial_capacity: data.financial_capacity ?? '', source: data.source ?? '', details: data.details ?? {},
      assigned_to: data.assigned_to ?? '', is_regular: data.is_regular ?? false, birthday: data.birthday ?? '',
    })
  }, [id])

  useEffect(() => { fetchPerson() }, [fetchPerson])

  useEffect(() => {
    fetch('/api/team/members')
      .then(r => r.ok ? r.json() : { members: [] })
      .then((d: { members: { id: string; name: string }[] }) => setMembers(d.members))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/pipelines').then(r => r.ok ? r.json() : []).then(setPipelines).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/agency')
      .then(r => r.ok ? r.json() : null)
      .then((d: { followup_first_days?: number; followup_second_days?: number } | null) => {
        if (d) setAgencyFollowup({ first: d.followup_first_days ?? 7, second: d.followup_second_days ?? 30 })
      })
      .catch(() => {})
      // Falha silenciosa: agencyFollowup fica null e a UI mostra texto
      // genérico em vez de arriscar números errados.
  }, [])

  // Etapas de cada pipeline com lead ativa (para o seletor inline de etapa)
  useEffect(() => {
    const ids = [...new Set((person?.leads ?? []).map(l => l.pipeline_id).filter((p): p is string => !!p))]
    ids.filter(pid => !stagesByPipeline[pid]).forEach(pid => {
      fetch(`/api/pipeline-stages?pipeline_id=${pid}`)
        .then(r => r.ok ? r.json() : [])
        .then(s => setStagesByPipeline(prev => ({ ...prev, [pid]: s })))
        .catch(() => {})
    })
  }, [person, stagesByPipeline])

  // Fechar o menu "+ Pipeline" ao clicar fora (padrão do NotificationBell)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pipelineMenuRef.current && !pipelineMenuRef.current.contains(e.target as Node)) {
        setPipelineMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function save() {
    const res = await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email || null,
        phone: form.phone.trim() ? normalizePhone(form.phone) : null,
        address: form.address || null,
        notes: form.notes || null,
        types: form.types,
        financial_capacity: form.financial_capacity || null,
        source: form.source || null,
        details: form.details,
        assigned_to: form.assigned_to || null,
        is_regular: form.is_regular,
        birthday: form.birthday || null,
      }),
    })
    if (res.ok) { setEditing(false); fetchPerson(); onChanged?.() }
  }

  // Alternar rapidamente o estado "regular" sem entrar em modo de edição
  async function toggleRegular() {
    if (!person) return
    const next = !person.is_regular
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_regular: next }),
    })
    fetchPerson()
    onChanged?.()
  }

  // Frequência de follow-up própria deste contacto (substitui os prazos
  // globais da agência quando definida). null = voltar a usar os prazos da agência.
  async function setRegularInterval(days: number | null) {
    const body: Record<string, unknown> = { regular_interval_days: days }
    if (days != null && !person?.is_regular) body.is_regular = true
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setCustomInterval('')
    fetchPerson()
    onChanged?.()
  }

  async function toggleSpecial() {
    if (!person) return
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_special: !person.is_special }),
    })
    fetchPerson()
    onChanged?.()
  }

  async function toggleCalendarSync() {
    if (!person) return
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendar_sync_enabled: !person.calendar_sync_enabled }),
    })
    fetchPerson()
    onChanged?.()
  }

  async function updateSpecialFlag(key: 'special_notify_christmas' | 'special_notify_easter' | 'special_notify_birthday', value: boolean) {
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })
    fetchPerson()
    onChanged?.()
  }

  async function addSpecialDate() {
    if (!person) return
    const month = Number(newSpecialDate.month)
    const day = Number(newSpecialDate.day)
    if (!newSpecialDate.label.trim() || !month || !day) return
    const next: ContactSpecialDate[] = [...(person.special_dates ?? []), { label: newSpecialDate.label.trim(), month, day }]
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ special_dates: next }),
    })
    setNewSpecialDate({ label: '', month: '', day: '' })
    fetchPerson()
    onChanged?.()
  }

  async function removeSpecialDate(index: number) {
    if (!person) return
    const next = (person.special_dates ?? []).filter((_, i) => i !== index)
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ special_dates: next }),
    })
    fetchPerson()
    onChanged?.()
  }

  async function addToPipelines(pipelineIds: string[], propertyId?: string | null) {
    if (pipelineIds.length === 0) return
    setPipelineBusy(true)
    setPipelineMenuOpen(false)
    try {
      const results = await Promise.allSettled(
        pipelineIds.map(pipelineId =>
          fetch(`/api/people/${id}/pipeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pipeline_id: pipelineId, ...(propertyId !== undefined ? { property_id: propertyId } : {}) }),
          })
        )
      )
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length
      if (failed > 0) {
        alert(`${failed} de ${pipelineIds.length} pipeline(s) não foram adicionadas.`)
      }
      fetchPerson(); onChanged?.()
    } finally {
      setPipelineBusy(false)
      setPipelineSelection([])
      setPropertyChoice('')
    }
  }

  async function removeFromPipeline(leadId: string) {
    if (!confirm('Remover desta pipeline? A lead é apagada; o contacto e o histórico ficam.')) return
    setPipelineBusy(true)
    try {
      const res = await fetch(`/api/people/${id}/pipeline?lead_id=${leadId}`, { method: 'DELETE' })
      if (res.ok) { fetchPerson(); onChanged?.() }
    } finally {
      setPipelineBusy(false)
    }
  }

  async function changeLeadStage(leadId: string, stageId: string) {
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: stageId }),
    })
    fetchPerson(); onChanged?.()
  }

  async function deletePerson() {
    if (!confirm('Eliminar esta pessoa? Os leads associados não serão eliminados.')) return
    await fetch(`/api/people/${id}`, { method: 'DELETE' })
    if (embedded) { onChanged?.(); onClose?.() } else { router.push('/people') }
  }


  if (!person) {
    return (
      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ height: 36, width: 260 }} />
        <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="skeleton" style={{ height: 140 }} />
            <div className="skeleton" style={{ height: 220 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="skeleton" style={{ height: 180 }} />
            <div className="skeleton" style={{ height: 140 }} />
          </div>
        </div>
      </div>
    )
  }

  const initials = person.name.split(' ').map(n => n[0]).slice(0, 2).join('')
  const totalDeals = person.leads?.length ?? 0
  const totalValue = person.leads?.reduce((sum, l) => sum + (l.deal_value ?? 0), 0) ?? 0

  const toggleType = (key: ContactTypeKey) =>
    setForm(p => ({ ...p, types: p.types.includes(key) ? p.types.filter(t => t !== key) : [...p.types, key] }))
  const setDetail = <K extends keyof ContactDetails>(k: K, v: ContactDetails[K]) =>
    setForm(p => ({ ...p, details: { ...p.details, [k]: v } }))

  // Leads "ativas" = etapa não fechada/perdida; pode haver uma por pipeline
  const activeLeads = (person.leads ?? []).filter(l => l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost)
  const leadsWithStageCadence = activeLeads.filter(l => l.stage_recurring_days != null && l.stage_recurring_days > 0)
  const missingPipelines = pipelines.filter(p => !activeLeads.some(l => l.pipeline_id === p.id))
  // Imóveis já associados a este contacto (vendedor, comprador candidato ou
  // consultor) — candidatos a ligar ao card quando se adiciona a uma
  // pipeline. Com 2+, o consultor escolhe qual usar antes de confirmar.
  const candidateProperties: PropertyRef[] = (() => {
    const seller = person.properties_as_seller ?? []
    const buyer = person.properties_as_buyer ?? []
    const consultant = (person.property_consultants ?? []).map(pc => pc.properties)
    const byId = new Map<string, PropertyRef>()
    for (const p of [...seller, ...buyer, ...consultant]) byId.set(p.id, p)
    return [...byId.values()]
  })()
  const age = person.birthday ? Math.floor((Date.now() - new Date(person.birthday).getTime()) / (365.25 * 24 * 3600 * 1000)) : null

  const activeTypes = person.types ?? []
  const showBuyer = activeTypes.includes('comprador') || activeTypes.includes('investidor')
  // Investidores também podem vender: mostram o bloco de venda. Sem o tipo
  // "vendedor", o campo principal chama-se "O que oferece".
  const showSeller = activeTypes.includes('vendedor') || activeTypes.includes('investidor')
  const sellingLabel = activeTypes.includes('vendedor') ? 'O que vende' : 'O que oferece'
  const showConsultant = activeTypes.includes('consultor')
  const showService = activeTypes.includes('servico')

  const d = editing ? form.details : (person.details ?? {})
  const yesNo = (v: boolean | undefined) => (v ? 'Sim' : 'Não')

  // Campo rótulo+valor: em modo edição mostra o controlo, senão o valor formatado
  const fieldValue = (v: string | null | undefined) => (
    <div style={{ fontSize: 'var(--fs-base)', color: v ? 'var(--text)' : 'var(--muted)' }}>{v || '—'}</div>
  )
  const field = (label: string, view: React.ReactNode, edit?: React.ReactNode) => (
    <div>
      <div className="section-label" style={{ marginBottom: 5 }}>{label}</div>
      {editing && edit ? edit : view}
    </div>
  )
  const boolField = (label: string, key: 'already_bought' | 'has_garage' | 'has_balcony' | 'has_exclusivity' | 'is_active_seller') =>
    field(
      label,
      <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text)' }}>{yesNo(d[key])}</div>,
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-base)', color: 'var(--text)', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!d[key]} onChange={e => setDetail(key, e.target.checked)} />
        {yesNo(d[key])}
      </label>
    )

  const cardTitle = (title: string) => (
    <div className="font-display" style={{ fontSize: 'var(--fs-md)', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>{title}</div>
  )

  return (
    <>
      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 10, padding: embedded ? '14px 20px' : '14px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="detail-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          {embedded ? (
            <button onClick={onClose} aria-label="Fechar" className="btn btn-ghost btn-sm" style={{ fontSize: 16, lineHeight: 1, padding: '4px 10px' }}>×</button>
          ) : (
            <>
              <Link href="/people" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 'var(--fs-base)', flexShrink: 0 }}>← Pessoas</Link>
              <span style={{ color: 'var(--border)', flexShrink: 0 }}>/</span>
            </>
          )}
          <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{person.name}</span>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          {!editing && missingPipelines.length > 0 && (
            <div ref={pipelineMenuRef} style={{ position: 'relative' }}>
              <button onClick={() => setPipelineMenuOpen(o => !o)} disabled={pipelineBusy} className="btn btn-soft">
                {pipelineBusy ? 'A adicionar…' : '+ Pipeline'}
              </button>
              {pipelineMenuOpen && (
                <div className="card" style={{ position: 'absolute', top: '110%', right: 0, zIndex: 30, minWidth: 200, padding: 10, display: 'flex', flexDirection: 'column', gap: 4, boxShadow: 'var(--shadow-md)' }}>
                  {missingPipelines.map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={pipelineSelection.includes(p.id)}
                        onChange={() => setPipelineSelection(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                      />
                      {p.name}
                    </label>
                  ))}
                  {candidateProperties.length >= 2 && (
                    <select
                      className="input"
                      value={propertyChoice}
                      onChange={e => setPropertyChoice(e.target.value)}
                      style={{ fontSize: 'var(--fs-sm)', padding: '4px 6px', marginTop: 4 }}
                    >
                      <option value="">Sem imóvel</option>
                      {candidateProperties.map(p => (
                        <option key={p.id} value={p.id}>{p.reference ? `${p.reference} — ${p.title}` : p.title}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={pipelineSelection.length === 0}
                    onClick={() => addToPipelines(pipelineSelection, candidateProperties.length >= 2 ? (propertyChoice || null) : undefined)}
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 6 }}
                  >
                    Adicionar
                  </button>
                </div>
              )}
            </div>
          )}
          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn btn-ghost">Editar</button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="btn btn-ghost">Cancelar</button>
              <button onClick={save} className="btn btn-primary">Guardar alterações</button>
            </>
          )}
          <button onClick={deletePerson} className="btn btn-danger">Eliminar</button>
        </div>
      </div>

      <div className="page-enter page-pad" style={{ padding: embedded ? '20px' : '24px 32px' }}>
        {/* Hero de identidade — quem é, tipos e números-chave num relance */}
        <div className="card" style={{ padding: '24px 28px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(to right, transparent, var(--gold-bright), transparent)', opacity: 0.5 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ width: 60, height: 60, flexShrink: 0, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold-bright), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-lg)', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(90,60,10,0.35)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), var(--shadow-sm)' }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              {editing ? (
                <input className="input" style={{ maxWidth: 360, fontSize: 'var(--fs-md)', fontWeight: 600 }} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              ) : (
                <h1 className="font-display" style={{ fontSize: 'var(--fs-xl)', margin: 0 }}>{person.name}</h1>
              )}
              {!editing && (person.types?.length ?? 0) > 0 && (
                <div style={{ marginTop: 8 }}><ContactTypeChips types={person.types ?? []} /></div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
              {[
                { label: 'Negócios', value: String(totalDeals) },
                { label: 'Valor total', value: totalValue > 0 ? `€${totalValue.toLocaleString('pt-PT')}` : '—' },
                { label: 'Pipeline', value: activeLeads.length > 0 ? `${activeLeads.length} ativa${activeLeads.length > 1 ? 's' : ''}` : 'Fora' },
              ].map((s, i) => (
                <div key={s.label} style={{ padding: '4px 20px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none', textAlign: 'center' }}>
                  <div className="font-display" style={{ fontSize: 'var(--fs-lg)', color: 'var(--text)', whiteSpace: 'nowrap' }}>{s.value}</div>
                  <div className="section-label" style={{ marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: embedded ? '1fr' : '1fr 1fr', gap: embedded ? 20 : 24 }}>
          {/* Coluna esquerda: dados do contacto agrupados por tema */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: 24 }}>
              {cardTitle('Contacto')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {field('Email',
                  fieldValue(person.email),
                  <input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                )}
                {field('Telefone',
                  fieldValue(person.phone ? formatPhoneDisplay(person.phone) : person.phone),
                  <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} onBlur={() => setForm(p => ({ ...p, phone: p.phone.trim() ? formatPhoneDisplay(p.phone) : p.phone }))} />
                )}
                {field('Morada',
                  fieldValue(person.address),
                  <input className="input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                )}
              </div>
            </div>

            <div className="card" style={{ padding: 24 }}>
              {cardTitle('Classificação')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {editing && (
                  <div>
                    <div className="section-label" style={{ marginBottom: 6 }}>Tipos</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {CONTACT_TYPES.map(t => {
                        const active = form.types.includes(t.key)
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => toggleType(t.key)}
                            className="chip"
                            style={active ? { background: `${t.color}18`, color: t.color, borderColor: `${t.color}66` } : undefined}
                          >{t.label}</button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {field('Capacidade financeira',
                  fieldValue(capacityMeta(person.financial_capacity)?.label),
                  <select className="input" value={form.financial_capacity} onChange={e => setForm(p => ({ ...p, financial_capacity: e.target.value }))}>
                    <option value="">—</option>
                    {CAPACITY_BANDS.map(b => <option key={b.key} value={b.key}>{b.label} ({b.range})</option>)}
                  </select>
                )}
                {field('Origem',
                  fieldValue(person.source),
                  <input className="input" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} />
                )}
                {field('Responsável',
                  fieldValue(members.find(m => m.id === person.assigned_to)?.name),
                  <select className="input" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                    <option value="">—</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                {field('Nascimento',
                  fieldValue(person.birthday ? `${new Date(person.birthday).toLocaleDateString('pt-PT')}${age != null ? ` · ${age} anos` : ''}` : null),
                  <input className="input" type="date" value={form.birthday} onChange={e => setForm(p => ({ ...p, birthday: e.target.value }))} />
                )}
              </div>
            </div>

            <div className="card" style={{ padding: 24 }}>
              {cardTitle('Acompanhamento')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Contacto regular (toggle rápido fora do modo edição) */}
                <div>
                  <div className="section-label" style={{ marginBottom: 6 }}>Follow-ups</div>

                  {/* Cadência efetiva: valor próprio do contacto → cadência da
                      etapa de cada lead ativo → prazos da agência (nesta ordem).
                      is_regular=false anula o valor próprio, mesmo que
                      regular_interval_days continue gravado — mesma condição
                      exigida pela supressão no cron stage-notifications e pelo
                      cron contact-followup (que só processa is_regular=true). */}
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
                    Cadência efetiva:{' '}
                    {person.is_regular && person.regular_interval_days != null ? (
                      <strong style={{ color: 'var(--text)', fontWeight: 600 }}>a cada {person.regular_interval_days} dias (definido para este contacto)</strong>
                    ) : leadsWithStageCadence.length > 0 ? (
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                        {leadsWithStageCadence.map(lead => (
                          <strong key={lead.id} style={{ color: 'var(--text)', fontWeight: 600 }}>
                            «{lead.pipelines?.name ?? 'Negócio'}» (etapa «{lead.pipeline_stages?.name ?? '—'}»): a cada {lead.stage_recurring_days} dias, definido na etapa
                          </strong>
                        ))}
                      </span>
                    ) : agencyFollowup ? (
                      <strong style={{ color: 'var(--text)', fontWeight: 600 }}>prazos da agência (padrão: primeiro aviso aos {agencyFollowup.first} dias, depois aos {agencyFollowup.second} dias)</strong>
                    ) : (
                      <strong style={{ color: 'var(--text)', fontWeight: 600 }}>prazos da agência (padrão)</strong>
                    )}
                  </div>

                  <button onClick={toggleRegular} className={`chip${person.is_regular ? ' active' : ''}`} style={{ width: '100%', justifyContent: 'space-between', padding: '8px 14px', borderRadius: 10 }}>
                    <span style={{ fontSize: 'var(--fs-sm)' }}>{person.is_regular ? '✓ Contacto regular' : 'Marcar como regular'}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.75, fontWeight: 500 }}>{person.is_regular ? 'lembretes ativos' : 'sem lembretes'}</span>
                  </button>

                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                      Frequência: <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{person.is_regular && person.regular_interval_days ? `a cada ${person.regular_interval_days} dias` : 'prazos da agência (padrão)'}</strong>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      <button type="button" onClick={() => setRegularInterval(null)} className={`chip${person.regular_interval_days == null ? ' active' : ''}`}>Prazos da agência</button>
                      {REGULAR_INTERVAL_PRESETS.map(dd => (
                        <button key={dd} type="button" onClick={() => setRegularInterval(dd)} className={`chip${person.regular_interval_days === dd ? ' active' : ''}`}>{dd} dias</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="input" style={{ width: 110 }} type="number" min={1} placeholder="outro (dias)" value={customInterval} onChange={e => setCustomInterval(e.target.value)} />
                      <button type="button" disabled={!customInterval} onClick={() => setRegularInterval(Number(customInterval))} className="btn btn-ghost btn-sm" style={{ height: 'auto' }}>Aplicar</button>
                    </div>
                  </div>
                </div>

                {/* Contacto especial (datas importantes) */}
                <div>
                  <div className="section-label" style={{ marginBottom: 6 }}>Datas importantes</div>
                  <button onClick={toggleSpecial} className={`chip${person.is_special ? ' active' : ''}`} style={{ width: '100%', justifyContent: 'space-between', padding: '8px 14px', borderRadius: 10 }}>
                    <span style={{ fontSize: 'var(--fs-sm)' }}>{person.is_special ? '✓ Contacto especial' : 'Marcar como especial'}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.75, fontWeight: 500 }}>{person.is_special ? 'datas ativas' : 'sem datas'}</span>
                  </button>

                  {person.is_special && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={person.special_notify_christmas} onChange={e => updateSpecialFlag('special_notify_christmas', e.target.checked)} />
                          🎄 Natal
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={person.special_notify_easter} onChange={e => updateSpecialFlag('special_notify_easter', e.target.checked)} />
                          🐣 Páscoa
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', cursor: person.birthday ? 'pointer' : 'not-allowed', opacity: person.birthday ? 1 : 0.5 }}>
                          <input type="checkbox" disabled={!person.birthday} checked={person.special_notify_birthday} onChange={e => updateSpecialFlag('special_notify_birthday', e.target.checked)} />
                          🎂 Aniversário
                        </label>
                      </div>
                      {!person.birthday && <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)' }}>Preenche a data de nascimento para ativar o aniversário.</div>}

                      {(person.special_dates ?? []).length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(person.special_dates ?? []).map((sd, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px' }}>
                              <span style={{ flex: 1, fontWeight: 500 }}>{sd.label} — {String(sd.day).padStart(2, '0')}/{String(sd.month).padStart(2, '0')}</span>
                              <button type="button" onClick={() => removeSpecialDate(i)} className="btn btn-danger btn-sm" style={{ padding: '2px 8px' }}>Remover</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="form-row-wrap" style={{ display: 'flex', gap: 6 }}>
                        <input className="input" style={{ flex: 2, minWidth: 120 }} placeholder="Ex: Aniversário de casamento" value={newSpecialDate.label} onChange={e => setNewSpecialDate(p => ({ ...p, label: e.target.value }))} />
                        <input className="input" style={{ width: 60 }} type="number" min={1} max={31} placeholder="Dia" value={newSpecialDate.day} onChange={e => setNewSpecialDate(p => ({ ...p, day: e.target.value }))} />
                        <input className="input" style={{ width: 60 }} type="number" min={1} max={12} placeholder="Mês" value={newSpecialDate.month} onChange={e => setNewSpecialDate(p => ({ ...p, month: e.target.value }))} />
                        <button type="button" onClick={addSpecialDate} className="btn btn-soft btn-sm" style={{ height: 'auto' }}>+ Adicionar</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sincronização com o calendário (interno + feed ICS pessoal) */}
                <div>
                  <div className="section-label" style={{ marginBottom: 6 }}>Calendário</div>
                  <button onClick={toggleCalendarSync} className={`chip${person.calendar_sync_enabled ? ' active' : ''}`} style={{ width: '100%', justifyContent: 'space-between', padding: '8px 14px', borderRadius: 10 }}>
                    <span style={{ fontSize: 'var(--fs-sm)' }}>{person.calendar_sync_enabled ? '✓ No calendário' : 'Adicionar notificações ao calendário'}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.75, fontWeight: 500 }}>{person.calendar_sync_enabled ? 'sincronizado' : 'não sincronizado'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Secção específica por tipo */}
            {(showBuyer || showSeller || showConsultant || showService) && (
              <div className="card" style={{ padding: 24 }}>
                {cardTitle('Detalhes')}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                  {showBuyer && (
                    <>
                      {field('O que procura', fieldValue(d.looking_for), <input className="input" value={d.looking_for ?? ''} onChange={e => setDetail('looking_for', e.target.value)} />)}
                      {field('Zona', fieldValue(d.search_zone), <input className="input" value={d.search_zone ?? ''} onChange={e => setDetail('search_zone', e.target.value)} />)}
                      {field('Preço máximo €', fieldValue(d.looking_price != null ? `€${d.looking_price.toLocaleString('pt-PT')}` : null), <input className="input" type="number" value={d.looking_price ?? ''} onChange={e => setDetail('looking_price', Number(e.target.value) || undefined)} />)}
                      {boolField('Já comprou', 'already_bought')}
                    </>
                  )}
                  {showSeller && (
                    <>
                      {field(sellingLabel, fieldValue(d.selling_property), <input className="input" value={d.selling_property ?? ''} onChange={e => setDetail('selling_property', e.target.value)} />)}
                      {field('Onde vende', fieldValue(d.selling_zone), <input className="input" value={d.selling_zone ?? ''} onChange={e => setDetail('selling_zone', e.target.value)} />)}
                      {field('Preço €', fieldValue(d.selling_price != null ? `€${d.selling_price.toLocaleString('pt-PT')}` : null), <input className="input" type="number" value={d.selling_price ?? ''} onChange={e => setDetail('selling_price', Number(e.target.value) || undefined)} />)}
                      {field('Tipologia', fieldValue(d.typology), <input className="input" value={d.typology ?? ''} onChange={e => setDetail('typology', e.target.value)} />)}
                      {boolField('Garagem', 'has_garage')}
                      {boolField('Varanda', 'has_balcony')}
                      {boolField('Exclusividade', 'has_exclusivity')}
                      {boolField('Vendedor ativo', 'is_active_seller')}
                    </>
                  )}
                  {showConsultant && (
                    <>
                      {field('Agência', fieldValue(d.agency_name), <input className="input" value={d.agency_name ?? ''} onChange={e => setDetail('agency_name', e.target.value)} />)}
                      {field('Zona de atuação', fieldValue(d.working_zone), <input className="input" value={d.working_zone ?? ''} onChange={e => setDetail('working_zone', e.target.value)} />)}
                    </>
                  )}
                  {showService && (
                    <>
                      {field('O que faz', fieldValue(d.service_type), <input className="input" value={d.service_type ?? ''} onChange={e => setDetail('service_type', e.target.value)} />)}
                      {!showConsultant && field('Zona de atuação', fieldValue(d.working_zone), <input className="input" value={d.working_zone ?? ''} onChange={e => setDetail('working_zone', e.target.value)} />)}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="card" style={{ padding: 24 }}>
              {cardTitle('Idealista')}
              {field('Link do anúncio', fieldValue(d.idealista_url), <input className="input" value={d.idealista_url ?? ''} onChange={e => setDetail('idealista_url', e.target.value)} />)}
            </div>

            <div className="card" style={{ padding: 24 }}>
              {cardTitle('Notas')}
              {editing ? (
                <textarea className="input" style={{ minHeight: 90 }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              ) : (
                <div style={{ fontSize: 'var(--fs-base)', color: person.notes ? 'var(--text)' : 'var(--muted)', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{person.notes ?? 'Sem notas.'}</div>
              )}
            </div>
          </div>

          {/* Coluna direita: IA, interações, negócios e associações */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <ContactAiSuggestion personId={id} />
            <InteractionTimeline personId={id} onLogged={fetchPerson} />
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div className="font-display" style={{ fontSize: 'var(--fs-md)' }}>Negócios</div>
                <Link href={`/leads?person_id=${id}`} style={{ fontSize: 'var(--fs-xs)', color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Ver todos →</Link>
              </div>

              {(!person.leads || person.leads.length === 0) ? (
                <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>
                  <div style={{ fontSize: 20, marginBottom: 6, opacity: 0.7 }}>◇</div>
                  Nenhum negócio associado.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeLeads.map(lead => {
                    const stages = lead.pipeline_id ? (stagesByPipeline[lead.pipeline_id] ?? []) : []
                    const highlight = lead.id === highlightLeadId
                    return (
                      <div key={lead.id} className="card" style={{ borderRadius: 10, padding: '12px 14px', boxShadow: 'none', border: highlight ? '1px solid var(--gold)' : undefined }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)' }}>{lead.pipelines?.name ?? 'Pipeline'}</div>
                          {lead.deal_value != null && lead.deal_value > 0 && (
                            <div className="font-display" style={{ fontSize: 'var(--fs-md)', color: 'var(--gold)' }}>€{lead.deal_value.toLocaleString('pt-PT')}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                          <select className="input" style={{ width: 'auto', minWidth: 140 }} value={lead.stage_id} onChange={e => changeLeadStage(lead.id, e.target.value)}>
                            {stages.filter(s => !s.is_lost).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <Link href={`/leads/${lead.id}`} style={{ fontSize: 'var(--fs-xs)', color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Ver negócio completo →</Link>
                          <button onClick={() => removeFromPipeline(lead.id)} disabled={pipelineBusy} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>Remover</button>
                        </div>
                      </div>
                    )
                  })}
                  {(person.leads ?? []).filter(l => !activeLeads.includes(l)).map(lead => {
                    const stage = lead.pipeline_stages
                    return (
                      <Link key={lead.id} href={`/leads/${lead.id}`} className="card card-hover" style={{ textDecoration: 'none', color: 'inherit', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, boxShadow: 'none' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            {stage && (
                              <span style={{ fontSize: 'var(--fs-2xs)', padding: '2px 9px', borderRadius: 999, background: `${stage.color}1A`, border: `1px solid ${stage.color}40`, color: stage.color, fontWeight: 600 }}>{stage.name}</span>
                            )}
                            <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)' }}>{new Date(lead.created_at).toLocaleDateString('pt-PT')}</span>
                          </div>
                        </div>
                        {lead.deal_value != null && lead.deal_value > 0 && (
                          <div className="font-display" style={{ fontSize: 'var(--fs-md)', color: 'var(--gold)', whiteSpace: 'nowrap' }}>€{lead.deal_value.toLocaleString('pt-PT')}</div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {showBuyer && (
              <ContactIdealistaPreferences personId={id} defaultZone={person.details?.search_zone} />
            )}

            {showSeller && (
              <SellerProperties personId={id} properties={person.properties_as_seller ?? []} onChange={fetchPerson} />
            )}

            {(person.properties_as_buyer ?? []).length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                {cardTitle('Imóveis comprados')}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(person.properties_as_buyer ?? []).map(p => (
                    <Link key={p.id} href={`/properties/${p.id}`} className="card card-hover" style={{ textDecoration: 'none', color: 'inherit', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, boxShadow: 'none' }}>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.reference ? `${p.reference} — ` : ''}{p.title}
                      </div>
                      {p.price != null && (
                        <div className="font-display" style={{ fontSize: 'var(--fs-md)', color: 'var(--gold)', whiteSpace: 'nowrap' }}>€{p.price.toLocaleString('pt-PT')}</div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {showConsultant && (
              <ConsultantProperties
                personId={id}
                associations={(person.property_consultants ?? []).map(pc => ({ id: pc.id, property: pc.properties }))}
                onChange={fetchPerson}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
