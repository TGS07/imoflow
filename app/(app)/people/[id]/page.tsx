'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Person } from '@/types'
import type { ContactDetails, ContactSpecialDate } from '@/types'
import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'
import { InteractionTimeline } from '@/components/contacts/InteractionTimeline'
import { CONTACT_TYPES, CAPACITY_BANDS, capacityMeta, type ContactTypeKey } from '@/lib/contacts/constants'
import { ContactAiSuggestion } from '@/components/contacts/ContactAiSuggestion'
import { ContactIdealistaPreferences } from '@/components/contacts/ContactIdealistaPreferences'
import { SellerProperties } from '@/components/contacts/SellerProperties'
import { ConsultantProperties } from '@/components/contacts/ConsultantProperties'
import { REGULAR_INTERVAL_PRESETS } from '@/lib/contacts/special-dates'

type LeadSummary = {
  id: string
  name: string
  stage_id: string
  deal_value: number | null
  expected_close_date: string | null
  created_at: string
  pipeline_stages?: { name: string; color: string; is_won: boolean; is_lost: boolean }
}

type PropertyRef = { id: string; title: string; status: string; price: number | null; reference: string | null }

type PersonDetail = Person & {
  leads?: LeadSummary[]
  properties_as_seller?: PropertyRef[]
  property_consultants?: { id: string; properties: PropertyRef }[]
}

export default function PersonPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [person, setPerson] = useState<PersonDetail | null>(null)
  const [editing, setEditing] = useState(false)
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [pipelineBusy, setPipelineBusy] = useState(false)
  const [customInterval, setCustomInterval] = useState('')
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

  async function save() {
    const res = await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
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
    if (res.ok) { setEditing(false); fetchPerson() }
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
  }

  // Frequência de follow-up própria deste contacto (substitui os prazos
  // globais da agência quando definida). null = voltar a usar os prazos da agência.
  async function setRegularInterval(days: number | null) {
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regular_interval_days: days }),
    })
    setCustomInterval('')
    fetchPerson()
  }

  async function toggleSpecial() {
    if (!person) return
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_special: !person.is_special }),
    })
    fetchPerson()
  }

  async function updateSpecialFlag(key: 'special_notify_christmas' | 'special_notify_easter' | 'special_notify_birthday', value: boolean) {
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })
    fetchPerson()
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
  }

  async function addToPipeline() {
    setPipelineBusy(true)
    try {
      const res = await fetch(`/api/people/${id}/pipeline`, { method: 'POST' })
      if (res.ok) fetchPerson()
    } finally {
      setPipelineBusy(false)
    }
  }

  async function removeFromPipeline() {
    if (!confirm('Remover do pipeline? A lead ativa é apagada; o contacto e o histórico ficam.')) return
    setPipelineBusy(true)
    try {
      const res = await fetch(`/api/people/${id}/pipeline`, { method: 'DELETE' })
      if (res.ok) fetchPerson()
    } finally {
      setPipelineBusy(false)
    }
  }

  async function deletePerson() {
    if (!confirm('Eliminar esta pessoa? Os leads associados não serão eliminados.')) return
    await fetch(`/api/people/${id}`, { method: 'DELETE' })
    router.push('/people')
  }

  if (!person) return <div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>A carregar...</div>

  const initials = person.name.split(' ').map(n => n[0]).slice(0, 2).join('')
  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif', width: '100%' }
  const labelStyle = { fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }
  const totalDeals = person.leads?.length ?? 0
  const totalValue = person.leads?.reduce((sum, l) => sum + (l.deal_value ?? 0), 0) ?? 0

  const toggleType = (key: ContactTypeKey) =>
    setForm(p => ({ ...p, types: p.types.includes(key) ? p.types.filter(t => t !== key) : [...p.types, key] }))
  const setDetail = <K extends keyof ContactDetails>(k: K, v: ContactDetails[K]) =>
    setForm(p => ({ ...p, details: { ...p.details, [k]: v } }))

  // Lead "ativa" = ligada a este contacto e numa etapa que não é fechada/perdida
  const activeLead = person.leads?.find(l => l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost) ?? null
  const age = person.birthday ? Math.floor((Date.now() - new Date(person.birthday).getTime()) / (365.25 * 24 * 3600 * 1000)) : null

  const activeTypes = person.types ?? []
  const showBuyer = activeTypes.includes('comprador') || activeTypes.includes('investidor')
  const showSeller = activeTypes.includes('vendedor')
  const showConsultant = activeTypes.includes('consultor')
  const showService = activeTypes.includes('servico')

  const d = editing ? form.details : (person.details ?? {})
  const yesNo = (v: boolean | undefined) => (v ? 'Sim' : 'Não')

  return (
    <>
      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 10, padding: '14px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="detail-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <Link href="/people" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13, flexShrink: 0 }}>← Pessoas</Link>
          <span style={{ color: 'var(--border)', flexShrink: 0 }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{person.name}</span>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!editing && (
            activeLead ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Link href="/pipeline" style={{ textDecoration: 'none', background: `${activeLead.pipeline_stages?.color ?? 'var(--gold)'}18`, border: `1px solid ${activeLead.pipeline_stages?.color ?? 'var(--gold)'}55`, borderRadius: 8, padding: '0 12px', height: 32, display: 'flex', alignItems: 'center', fontSize: 12, color: activeLead.pipeline_stages?.color ?? 'var(--gold)', fontWeight: 600 }}>
                  No pipeline · {activeLead.pipeline_stages?.name ?? 'Lead'}
                </Link>
                <button onClick={removeFromPipeline} disabled={pipelineBusy} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', height: 32, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Remover</button>
              </div>
            ) : (
              <button onClick={addToPipeline} disabled={pipelineBusy} style={{ background: 'var(--gold-glow)', border: '1px solid var(--gold)', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, color: 'var(--gold)', cursor: 'pointer', fontFamily: 'Jost, sans-serif', fontWeight: 600 }}>{pipelineBusy ? '…' : '+ Pipeline'}</button>
            )
          )}
          {!editing ? (
            <button onClick={() => setEditing(true)} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Editar</button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Cancelar</button>
              <button onClick={save} style={{ background: 'var(--gold)', border: 'none', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, fontWeight: 600, color: '#0D0D0F', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Guardar</button>
            </>
          )}
          <button onClick={deletePerson} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, color: '#EF4444', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Eliminar</button>
        </div>
      </div>

      <div className="two-col-grid page-pad" style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: Person Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: '#0D0D0F' }}>{initials}</div>
              <div>
                {editing ? (
                  <input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                ) : (
                  <div className="font-display" style={{ fontSize: 18 }}>{person.name}</div>
                )}
                {!editing && (person.types?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 6 }}><ContactTypeChips types={person.types ?? []} /></div>
                )}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{totalDeals} negócio{totalDeals !== 1 ? 's' : ''} · {totalValue > 0 ? `€${totalValue.toLocaleString('pt-PT')}` : 'Sem valor'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Email', key: 'email' as const, type: 'email' },
                { label: 'Telefone', key: 'phone' as const },
                { label: 'Morada', key: 'address' as const },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>{label}</div>
                  {editing ? (
                    <input style={inputStyle} type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                  ) : (
                    <div style={{ fontSize: 13, color: person[key] ? 'var(--text)' : 'var(--muted)' }}>{person[key] ?? '—'}</div>
                  )}
                </div>
              ))}

              {/* Tipos de contacto */}
              {editing && (
                <div>
                  <div style={labelStyle}>Tipos</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {CONTACT_TYPES.map(t => {
                      const active = form.types.includes(t.key)
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => toggleType(t.key)}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                            fontFamily: 'Jost, sans-serif',
                            background: active ? `${t.color}18` : 'var(--surface)',
                            color: active ? t.color : 'var(--muted)',
                            border: `1px solid ${active ? `${t.color}55` : 'var(--border)'}`,
                          }}
                        >{t.label}</button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Capacidade financeira */}
              <div>
                <div style={labelStyle}>Capacidade financeira</div>
                {editing ? (
                  <select style={inputStyle} value={form.financial_capacity} onChange={e => setForm(p => ({ ...p, financial_capacity: e.target.value }))}>
                    <option value="">—</option>
                    {CAPACITY_BANDS.map(b => <option key={b.key} value={b.key}>{b.label} ({b.range})</option>)}
                  </select>
                ) : (
                  <div style={{ fontSize: 13, color: person.financial_capacity ? 'var(--text)' : 'var(--muted)' }}>{capacityMeta(person.financial_capacity)?.label ?? '—'}</div>
                )}
              </div>

              {/* Origem */}
              <div>
                <div style={labelStyle}>Origem</div>
                {editing ? (
                  <input style={inputStyle} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} />
                ) : (
                  <div style={{ fontSize: 13, color: person.source ? 'var(--text)' : 'var(--muted)' }}>{person.source ?? '—'}</div>
                )}
              </div>

              {/* Responsável */}
              <div>
                <div style={labelStyle}>Responsável</div>
                {editing ? (
                  <select style={inputStyle} value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                    <option value="">—</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                ) : (
                  <div style={{ fontSize: 13, color: person.assigned_to ? 'var(--text)' : 'var(--muted)' }}>{members.find(m => m.id === person.assigned_to)?.name ?? '—'}</div>
                )}
              </div>

              {/* Nascimento */}
              <div>
                <div style={labelStyle}>Nascimento</div>
                {editing ? (
                  <input style={inputStyle} type="date" value={form.birthday} onChange={e => setForm(p => ({ ...p, birthday: e.target.value }))} />
                ) : (
                  <div style={{ fontSize: 13, color: person.birthday ? 'var(--text)' : 'var(--muted)' }}>{person.birthday ? `${new Date(person.birthday).toLocaleDateString('pt-PT')}${age != null ? ` · ${age} anos` : ''}` : '—'}</div>
                )}
              </div>

              {/* Contacto regular (toggle rápido fora do modo edição) */}
              <div>
                <div style={labelStyle}>Follow-ups</div>
                <button onClick={toggleRegular} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', background: person.is_regular ? 'var(--gold-glow)' : 'var(--surface)', border: `1px solid ${person.is_regular ? 'var(--gold)' : 'var(--border)'}`, color: person.is_regular ? 'var(--gold)' : 'var(--muted)', borderRadius: 8, padding: '7px 12px', fontFamily: 'Jost, sans-serif', width: '100%' }}>
                  <span style={{ fontWeight: 600 }}>{person.is_regular ? '✓ Contacto regular' : 'Marcar como regular'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.8 }}>{person.is_regular ? 'lembretes ativos' : 'sem lembretes'}</span>
                </button>

                {person.is_regular && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      Frequência: {person.regular_interval_days ? `a cada ${person.regular_interval_days} dias` : 'prazos da agência (padrão)'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      <button type="button" onClick={() => setRegularInterval(null)} style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 6, cursor: 'pointer', fontFamily: 'Jost, sans-serif', background: person.regular_interval_days == null ? 'var(--gold-glow)' : 'var(--surface)', color: person.regular_interval_days == null ? 'var(--gold)' : 'var(--muted)', border: `1px solid ${person.regular_interval_days == null ? 'var(--gold)' : 'var(--border)'}` }}>Prazos da agência</button>
                      {REGULAR_INTERVAL_PRESETS.map(d => (
                        <button key={d} type="button" onClick={() => setRegularInterval(d)} style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 6, cursor: 'pointer', fontFamily: 'Jost, sans-serif', background: person.regular_interval_days === d ? 'var(--gold-glow)' : 'var(--surface)', color: person.regular_interval_days === d ? 'var(--gold)' : 'var(--muted)', border: `1px solid ${person.regular_interval_days === d ? 'var(--gold)' : 'var(--border)'}` }}>{d} dias</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input style={{ ...inputStyle, width: 90 }} type="number" min={1} placeholder="outro (dias)" value={customInterval} onChange={e => setCustomInterval(e.target.value)} />
                      <button type="button" disabled={!customInterval} onClick={() => setRegularInterval(Number(customInterval))} style={{ fontSize: 11, fontWeight: 600, padding: '0 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'Jost, sans-serif', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>Aplicar</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Contacto especial (datas importantes) */}
              <div>
                <div style={labelStyle}>Datas importantes</div>
                <button onClick={toggleSpecial} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', background: person.is_special ? 'var(--gold-glow)' : 'var(--surface)', border: `1px solid ${person.is_special ? 'var(--gold)' : 'var(--border)'}`, color: person.is_special ? 'var(--gold)' : 'var(--muted)', borderRadius: 8, padding: '7px 12px', fontFamily: 'Jost, sans-serif', width: '100%' }}>
                  <span style={{ fontWeight: 600 }}>{person.is_special ? '✓ Contacto especial' : 'Marcar como especial'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.8 }}>{person.is_special ? 'datas ativas' : 'sem datas'}</span>
                </button>

                {person.is_special && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={person.special_notify_christmas} onChange={e => updateSpecialFlag('special_notify_christmas', e.target.checked)} />
                        🎄 Natal
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={person.special_notify_easter} onChange={e => updateSpecialFlag('special_notify_easter', e.target.checked)} />
                        🐣 Páscoa
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: person.birthday ? 'pointer' : 'not-allowed', opacity: person.birthday ? 1 : 0.5 }}>
                        <input type="checkbox" disabled={!person.birthday} checked={person.special_notify_birthday} onChange={e => updateSpecialFlag('special_notify_birthday', e.target.checked)} />
                        🎂 Aniversário
                      </label>
                    </div>
                    {!person.birthday && <div style={{ fontSize: 10, color: 'var(--muted)' }}>Preenche a data de nascimento para ativar o aniversário.</div>}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(person.special_dates ?? []).map((sd, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px' }}>
                          <span style={{ flex: 1 }}>{sd.label} — {String(sd.day).padStart(2, '0')}/{String(sd.month).padStart(2, '0')}</span>
                          <button type="button" onClick={() => removeSpecialDate(i)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11, cursor: 'pointer' }}>Remover</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input style={{ ...inputStyle, flex: 2 }} placeholder="Ex: Aniversário de casamento" value={newSpecialDate.label} onChange={e => setNewSpecialDate(p => ({ ...p, label: e.target.value }))} />
                      <input style={{ ...inputStyle, width: 56 }} type="number" min={1} max={31} placeholder="Dia" value={newSpecialDate.day} onChange={e => setNewSpecialDate(p => ({ ...p, day: e.target.value }))} />
                      <input style={{ ...inputStyle, width: 56 }} type="number" min={1} max={12} placeholder="Mês" value={newSpecialDate.month} onChange={e => setNewSpecialDate(p => ({ ...p, month: e.target.value }))} />
                      <button type="button" onClick={addSpecialDate} style={{ fontSize: 11, fontWeight: 600, padding: '0 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'Jost, sans-serif', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>+ Adicionar</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Secção específica por tipo */}
              {(showBuyer || showSeller || showConsultant || showService) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div className="font-display" style={{ fontSize: 13 }}>Detalhes</div>

                  {showBuyer && (
                    <>
                      <div>
                        <div style={labelStyle}>O que procura</div>
                        {editing ? (
                          <input style={inputStyle} value={d.looking_for ?? ''} onChange={e => setDetail('looking_for', e.target.value)} />
                        ) : (
                          <div style={{ fontSize: 13, color: d.looking_for ? 'var(--text)' : 'var(--muted)' }}>{d.looking_for ?? '—'}</div>
                        )}
                      </div>
                      <div>
                        <div style={labelStyle}>Zona</div>
                        {editing ? (
                          <input style={inputStyle} value={d.search_zone ?? ''} onChange={e => setDetail('search_zone', e.target.value)} />
                        ) : (
                          <div style={{ fontSize: 13, color: d.search_zone ? 'var(--text)' : 'var(--muted)' }}>{d.search_zone ?? '—'}</div>
                        )}
                      </div>
                      <div>
                        <div style={labelStyle}>Já comprou</div>
                        {editing ? (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                            <input type="checkbox" checked={!!d.already_bought} onChange={e => setDetail('already_bought', e.target.checked)} />
                            {yesNo(d.already_bought)}
                          </label>
                        ) : (
                          <div style={{ fontSize: 13, color: 'var(--text)' }}>{yesNo(d.already_bought)}</div>
                        )}
                      </div>
                    </>
                  )}

                  {showSeller && (
                    <>
                      <div>
                        <div style={labelStyle}>O que vende</div>
                        {editing ? (
                          <input style={inputStyle} value={d.selling_property ?? ''} onChange={e => setDetail('selling_property', e.target.value)} />
                        ) : (
                          <div style={{ fontSize: 13, color: d.selling_property ? 'var(--text)' : 'var(--muted)' }}>{d.selling_property ?? '—'}</div>
                        )}
                      </div>
                      <div>
                        <div style={labelStyle}>Onde vende</div>
                        {editing ? (
                          <input style={inputStyle} value={d.selling_zone ?? ''} onChange={e => setDetail('selling_zone', e.target.value)} />
                        ) : (
                          <div style={{ fontSize: 13, color: d.selling_zone ? 'var(--text)' : 'var(--muted)' }}>{d.selling_zone ?? '—'}</div>
                        )}
                      </div>
                      <div>
                        <div style={labelStyle}>Preço €</div>
                        {editing ? (
                          <input style={inputStyle} type="number" value={d.selling_price ?? ''} onChange={e => setDetail('selling_price', Number(e.target.value) || undefined)} />
                        ) : (
                          <div style={{ fontSize: 13, color: d.selling_price ? 'var(--text)' : 'var(--muted)' }}>{d.selling_price != null ? `€${d.selling_price.toLocaleString('pt-PT')}` : '—'}</div>
                        )}
                      </div>
                      <div>
                        <div style={labelStyle}>Tipologia</div>
                        {editing ? (
                          <input style={inputStyle} value={d.typology ?? ''} onChange={e => setDetail('typology', e.target.value)} />
                        ) : (
                          <div style={{ fontSize: 13, color: d.typology ? 'var(--text)' : 'var(--muted)' }}>{d.typology ?? '—'}</div>
                        )}
                      </div>
                      <div>
                        <div style={labelStyle}>Garagem</div>
                        {editing ? (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                            <input type="checkbox" checked={!!d.has_garage} onChange={e => setDetail('has_garage', e.target.checked)} />
                            {yesNo(d.has_garage)}
                          </label>
                        ) : (
                          <div style={{ fontSize: 13, color: 'var(--text)' }}>{yesNo(d.has_garage)}</div>
                        )}
                      </div>
                      <div>
                        <div style={labelStyle}>Varanda</div>
                        {editing ? (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                            <input type="checkbox" checked={!!d.has_balcony} onChange={e => setDetail('has_balcony', e.target.checked)} />
                            {yesNo(d.has_balcony)}
                          </label>
                        ) : (
                          <div style={{ fontSize: 13, color: 'var(--text)' }}>{yesNo(d.has_balcony)}</div>
                        )}
                      </div>
                      <div>
                        <div style={labelStyle}>Exclusividade</div>
                        {editing ? (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                            <input type="checkbox" checked={!!d.has_exclusivity} onChange={e => setDetail('has_exclusivity', e.target.checked)} />
                            {yesNo(d.has_exclusivity)}
                          </label>
                        ) : (
                          <div style={{ fontSize: 13, color: 'var(--text)' }}>{yesNo(d.has_exclusivity)}</div>
                        )}
                      </div>
                      <div>
                        <div style={labelStyle}>Vendedor ativo</div>
                        {editing ? (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                            <input type="checkbox" checked={!!d.is_active_seller} onChange={e => setDetail('is_active_seller', e.target.checked)} />
                            {yesNo(d.is_active_seller)}
                          </label>
                        ) : (
                          <div style={{ fontSize: 13, color: 'var(--text)' }}>{yesNo(d.is_active_seller)}</div>
                        )}
                      </div>
                    </>
                  )}

                  {showConsultant && (
                    <>
                      <div>
                        <div style={labelStyle}>Agência</div>
                        {editing ? (
                          <input style={inputStyle} value={d.agency_name ?? ''} onChange={e => setDetail('agency_name', e.target.value)} />
                        ) : (
                          <div style={{ fontSize: 13, color: d.agency_name ? 'var(--text)' : 'var(--muted)' }}>{d.agency_name ?? '—'}</div>
                        )}
                      </div>
                      <div>
                        <div style={labelStyle}>Zona de atuação</div>
                        {editing ? (
                          <input style={inputStyle} value={d.working_zone ?? ''} onChange={e => setDetail('working_zone', e.target.value)} />
                        ) : (
                          <div style={{ fontSize: 13, color: d.working_zone ? 'var(--text)' : 'var(--muted)' }}>{d.working_zone ?? '—'}</div>
                        )}
                      </div>
                    </>
                  )}

                  {showService && (
                    <>
                      <div>
                        <div style={labelStyle}>O que faz</div>
                        {editing ? (
                          <input style={inputStyle} value={d.service_type ?? ''} onChange={e => setDetail('service_type', e.target.value)} />
                        ) : (
                          <div style={{ fontSize: 13, color: d.service_type ? 'var(--text)' : 'var(--muted)' }}>{d.service_type ?? '—'}</div>
                        )}
                      </div>
                      {!showConsultant && (
                        <div>
                          <div style={labelStyle}>Zona de atuação</div>
                          {editing ? (
                            <input style={inputStyle} value={d.working_zone ?? ''} onChange={e => setDetail('working_zone', e.target.value)} />
                          ) : (
                            <div style={{ fontSize: 13, color: d.working_zone ? 'var(--text)' : 'var(--muted)' }}>{d.working_zone ?? '—'}</div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                </div>
              )}

              <div>
                <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>Notas</div>
                {editing ? (
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' as const }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                ) : (
                  <div style={{ fontSize: 13, color: person.notes ? 'var(--text)' : 'var(--muted)', whiteSpace: 'pre-wrap' }}>{person.notes ?? '—'}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: AI Suggestion + Interactions + Deals + Idealista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ContactAiSuggestion personId={id} />
          <InteractionTimeline personId={id} onLogged={fetchPerson} />
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="font-display" style={{ fontSize: 15 }}>Negócios</div>
              <Link href={`/leads?person_id=${id}`} style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}>Ver todos →</Link>
            </div>

            {(!person.leads || person.leads.length === 0) ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Nenhum negócio associado.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {person.leads.map(lead => {
                  const stage = lead.pipeline_stages
                  return (
                    <Link key={lead.id} href={`/leads/${lead.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{lead.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            {stage && (
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${stage.color}22`, color: stage.color, fontWeight: 500 }}>{stage.name}</span>
                            )}
                            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{new Date(lead.created_at).toLocaleDateString('pt-PT')}</span>
                          </div>
                        </div>
                        {lead.deal_value != null && lead.deal_value > 0 && (
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>€{lead.deal_value.toLocaleString('pt-PT')}</div>
                        )}
                      </div>
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

          {showConsultant && (
            <ConsultantProperties
              personId={id}
              associations={(person.property_consultants ?? []).map(pc => ({ id: pc.id, property: pc.properties }))}
              onChange={fetchPerson}
            />
          )}
        </div>
      </div>
    </>
  )
}
