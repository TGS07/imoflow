'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Person } from '@/types'
import type { ContactDetails } from '@/types'
import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'
import { InteractionTimeline } from '@/components/contacts/InteractionTimeline'
import { CONTACT_TYPES, CAPACITY_BANDS, capacityMeta, type ContactTypeKey } from '@/lib/contacts/constants'
import { NewLeadModal } from '@/components/leads/NewLeadModal'

type LeadSummary = {
  id: string
  name: string
  stage_id: string
  deal_value: number | null
  expected_close_date: string | null
  created_at: string
  pipeline_stages?: { name: string; color: string; is_won: boolean; is_lost: boolean }
}

type PersonDetail = Person & { leads?: LeadSummary[] }

export default function PersonPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [person, setPerson] = useState<PersonDetail | null>(null)
  const [editing, setEditing] = useState(false)
  const [showNewLead, setShowNewLead] = useState(false)
  const [form, setForm] = useState<{
    name: string; email: string; phone: string; address: string; notes: string
    types: ContactTypeKey[]; financial_capacity: string; source: string; details: ContactDetails
  }>({ name: '', email: '', phone: '', address: '', notes: '', types: [], financial_capacity: '', source: '', details: {} })

  const fetchPerson = useCallback(async () => {
    const res = await fetch(`/api/people/${id}`)
    if (!res.ok) return
    const data = await res.json()
    setPerson(data)
    setForm({
      name: data.name, email: data.email ?? '', phone: data.phone ?? '', address: data.address ?? '', notes: data.notes ?? '',
      types: data.types ?? [], financial_capacity: data.financial_capacity ?? '', source: data.source ?? '', details: data.details ?? {},
    })
  }, [id])

  useEffect(() => { fetchPerson() }, [fetchPerson])

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
      }),
    })
    if (res.ok) { setEditing(false); fetchPerson() }
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

  const activeTypes = person.types ?? []
  const showBuyer = activeTypes.includes('comprador') || activeTypes.includes('investidor')
  const showSeller = activeTypes.includes('vendedor')
  const showService = activeTypes.includes('servico')

  const d = editing ? form.details : (person.details ?? {})
  const yesNo = (v: boolean | undefined) => (v ? 'Sim' : 'Não')

  return (
    <>
      {showNewLead && (
        <NewLeadModal
          initialPerson={person}
          initialValues={{
            zone: person.details?.selling_zone ?? person.details?.search_zone,
            typology: person.details?.typology,
            budget: person.details?.selling_price,
          }}
          onClose={() => setShowNewLead(false)}
          onCreated={fetchPerson}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <Link href="/people" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13, flexShrink: 0 }}>← Pessoas</Link>
          <span style={{ color: 'var(--border)', flexShrink: 0 }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{person.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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

      <div className="two-col-grid" style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
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

              {/* Secção específica por tipo */}
              {(showBuyer || showSeller || showService) && (
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
                        <div style={labelStyle}>Temperatura</div>
                        {editing ? (
                          <select style={inputStyle} value={d.temperature ?? ''} onChange={e => setDetail('temperature', (e.target.value || undefined) as ContactDetails['temperature'])}>
                            <option value="">—</option>
                            <option value="quente">Quente</option>
                            <option value="morno">Morno</option>
                            <option value="frio">Frio</option>
                          </select>
                        ) : (
                          <div style={{ fontSize: 13, color: d.temperature ? 'var(--text)' : 'var(--muted)', textTransform: 'capitalize' }}>{d.temperature ?? '—'}</div>
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

                  {showService && (
                    <div>
                      <div style={labelStyle}>Tipo de serviço</div>
                      {editing ? (
                        <input style={inputStyle} value={d.service_type ?? ''} onChange={e => setDetail('service_type', e.target.value)} />
                      ) : (
                        <div style={{ fontSize: 13, color: d.service_type ? 'var(--text)' : 'var(--muted)' }}>{d.service_type ?? '—'}</div>
                      )}
                    </div>
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

        {/* Right: Interactions + Deals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <InteractionTimeline personId={id} onLogged={fetchPerson} />
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="font-display" style={{ fontSize: 15 }}>Negócios</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setShowNewLead(true)} style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'Jost, sans-serif', padding: 0 }}>+ Criar negócio</button>
                <Link href={`/leads?person_id=${id}`} style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}>Ver todos →</Link>
              </div>
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
        </div>
      </div>
    </>
  )
}
