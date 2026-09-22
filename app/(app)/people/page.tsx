'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { HelpButton } from '@/components/help/HelpButton'
import { useRouter } from 'next/navigation'
import type { Person } from '@/types'
import { CONTACT_TYPES, capacityMeta, contactTypeMeta, avatarColor, type ContactTypeKey } from '@/lib/contacts/constants'
import { EmptyState } from '@/components/ui/EmptyState'
import { NewContactModal } from '@/components/contacts/NewContactModal'
import { ContactFilters, EMPTY_FILTERS, applyContactFilters, type ContactFilterState } from '@/components/contacts/ContactFilters'
import { buildWaLink, formatPhoneDisplay, normalizePhone } from '@/lib/whatsapp/utils'
import { Icon } from '@/components/ui/Icon'

const STALE_DAYS = 10

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}
function relativeContact(iso: string | null): string {
  const d = daysSince(iso)
  if (d == null) return 'Sem contacto'
  if (d === 0) return 'Hoje'
  if (d === 1) return 'Ontem'
  return `Há ${d} dias`
}

function SummaryLine({ p }: { p: Person }) {
  const dot = ' · '
  const t = p.types ?? []

  if (t.includes('vendedor') || (t.includes('investidor') && (p.details?.selling_property || p.details?.selling_zone))) {
    const parts: string[] = []
    if (p.details?.selling_property) parts.push(p.details.selling_property)
    if (p.details?.selling_zone) parts.push(p.details.selling_zone)
    if (p.details?.selling_price != null) parts.push(`€${p.details.selling_price.toLocaleString('pt-PT')}`)
    return <span>{parts.join(dot) || '—'}</span>
  }

  if (t.includes('comprador') || t.includes('investidor')) {
    const parts: string[] = []
    if (p.details?.looking_for) parts.push(p.details.looking_for)
    if (p.details?.search_zone) parts.push(p.details.search_zone)
    if (capacityMeta(p.financial_capacity)?.label) parts.push(capacityMeta(p.financial_capacity)!.label)
    return <span>{parts.join(dot) || '—'}</span>
  }

  if (t.includes('consultor')) {
    const parts: string[] = []
    if (p.details?.agency_name) parts.push(p.details.agency_name)
    if (p.details?.working_zone) parts.push(p.details.working_zone)
    return <span>{parts.join(dot) || '—'}</span>
  }

  if (t.includes('servico')) {
    const parts: string[] = []
    if (p.details?.service_type) parts.push(p.details.service_type)
    if (p.details?.working_zone) parts.push(p.details.working_zone)
    return <span>{parts.join(dot) || '—'}</span>
  }

  return <span>—</span>
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTypes, setActiveTypes] = useState<ContactTypeKey[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<ContactFilterState>(EMPTY_FILTERS)
  const router = useRouter()

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch('/api/people')
      if (!res.ok) throw new Error()
      setPeople(await res.json())
    } catch { setPeople([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPeople() }, [fetchPeople])

  const toggleType = (t: ContactTypeKey) =>
    setActiveTypes(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))

  const visible = useMemo(() => {
    let list = applyContactFilters(people, filters)
    if (activeTypes.length) list = list.filter(p => (p.types ?? []).some(t => activeTypes.includes(t)))
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.phone ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.address ?? '').toLowerCase().includes(q) ||
        (p.details?.search_zone ?? '').toLowerCase().includes(q) ||
        (p.details?.selling_zone ?? '').toLowerCase().includes(q) ||
        (p.details?.working_zone ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [people, filters, activeTypes, search])

  const duplicateCount = useMemo(() => {
    const seen = new Map<string, number>()
    for (const p of people) {
      if (!p.phone) continue
      const key = normalizePhone(p.phone)
      if (!key) continue
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    return [...seen.values()].filter(n => n > 1).length
  }, [people])

  const filtering = search.trim().length > 0 || activeTypes.length > 0 || JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <div className="page-enter" style={{ padding: 'var(--space-6) var(--space-8)' }}>
      {showModal && (
        <NewContactModal
          onClose={() => setShowModal(false)}
          onCreated={fetchPeople}
        />
      )}

      {/* Header */}
      <div className="contacts-header">
        <div style={{ minWidth: 0 }}>
          <h1 className="font-display" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.1 }}>
            Contactos <HelpButton section="people" />
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>{visible.length} contactos</span>
            {duplicateCount > 0 && (
              <a href="/people/duplicates" className="contacts-dup-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5.3" /><circle cx="18" cy="18" r="4" /><path d="M18 16v4" /><circle cx="18" cy="21.5" r=".3" /></svg>
                {duplicateCount} duplicado{duplicateCount > 1 ? 's' : ''}
              </a>
            )}
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>
          <Icon name="user-plus" size={15} />
          <span className="contacts-btn-label">Novo Contacto</span>
        </button>
      </div>

      {/* Filters + Search row */}
      <div className="contacts-toolbar">
        <div className="contacts-chips">
          <button
            onClick={() => setActiveTypes([])}
            className={`chip${activeTypes.length === 0 ? ' active' : ''}`}
          >
            Todos
          </button>
          {CONTACT_TYPES.map(meta => {
            const active = activeTypes.includes(meta.key)
            return (
              <button
                key={meta.key}
                onClick={() => toggleType(meta.key)}
                className="chip"
                style={active ? { background: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}66` } : undefined}
              >
                {meta.plural}
              </button>
            )
          })}
        </div>
        <div className="contacts-search-row">
          <div className="contacts-search-wrap">
            <Icon name="search" size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <input
              className="contacts-search-input"
              placeholder="Pesquisar…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => setShowFilters(s => !s)} className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>
            <Icon name="settings" size={13} />
            Filtros
          </button>
        </div>
      </div>

      {showFilters && (
        <ContactFilters value={filters} onChange={setFilters} onClose={() => setShowFilters(false)} />
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 0 }} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          {filtering ? (
            <EmptyState illustration="search" title="Nenhum resultado" description="Não encontrámos contactos com esses critérios." />
          ) : (
            <EmptyState illustration="people" title="Ainda não tens contactos" description="Cria o teu primeiro contacto para começar a organizar compradores, vendedores e investidores." action={{ label: '+ Novo Contacto', onClick: () => setShowModal(true) }} />
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="contacts-table-wrap">
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th className="contacts-col-type">Tipo</th>
                  <th className="contacts-col-phone">Telefone</th>
                  <th className="contacts-col-last">Último Contacto</th>
                  <th className="contacts-col-actions">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => {
                  const days = daysSince(p.last_interaction_at)
                  const stale = days != null && days > STALE_DAYS
                  const initials = p.name.split(' ').map(n => n[0]).slice(0, 2).join('')
                  const primaryType = (p.types ?? [])[0]
                  const typeMeta = primaryType ? contactTypeMeta(primaryType) : null
                  const ac = avatarColor(p.name, p.types)

                  return (
                    <tr key={p.id} onClick={() => router.push(`/people/${p.id}`)}>
                      <td>
                        <div className="contacts-name-cell">
                          <div className="contacts-avatar" style={{ background: ac.bg, color: ac.text }}>{initials}</div>
                          <div className="contacts-name-info">
                            <span className="contacts-name">{p.name}</span>
                            <span className="contacts-summary"><SummaryLine p={p} /></span>
                          </div>
                        </div>
                      </td>
                      <td className="contacts-col-type">
                        {typeMeta ? (
                          <span className="contacts-type-badge" style={{ background: `${typeMeta.color}18`, color: typeMeta.color, borderColor: `${typeMeta.color}33` }}>
                            {typeMeta.label}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td className="contacts-col-phone" style={{ color: 'var(--muted)' }}>
                        {p.phone ? formatPhoneDisplay(p.phone) : '—'}
                      </td>
                      <td className="contacts-col-last" style={stale ? undefined : { color: 'var(--muted)' }}>
                        <span className={stale ? 'contacts-stale' : ''}>
                          {relativeContact(p.last_interaction_at)}
                          {stale && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <path d="M12 9v4" /><path d="M12 17h.01" />
                              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            </svg>
                          )}
                        </span>
                      </td>
                      <td className="contacts-col-actions">
                        <div className="contacts-actions">
                          {p.phone && (
                            <a href={`tel:${p.phone}`} onClick={e => e.stopPropagation()} className="contacts-action-btn" title="Ligar">
                              <Icon name="phone" size={14} />
                            </a>
                          )}
                          {p.phone && (
                            <a
                              href={buildWaLink(p.phone, `Olá ${p.name.split(' ')[0]}!`)}
                              target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="contacts-action-btn contacts-action-wa"
                              title="WhatsApp"
                            >
                              <Icon name="whatsapp" size={14} />
                            </a>
                          )}
                          {p.email && (
                            <a href={`mailto:${p.email}`} onClick={e => e.stopPropagation()} className="contacts-action-btn" title="Email">
                              <Icon name="mail" size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="contacts-mobile-list">
            {visible.map(p => {
              const days = daysSince(p.last_interaction_at)
              const stale = days != null && days > STALE_DAYS
              const initials = p.name.split(' ').map(n => n[0]).slice(0, 2).join('')
              const primaryType = (p.types ?? [])[0]
              const typeMeta = primaryType ? contactTypeMeta(primaryType) : null
              const ac = avatarColor(p.name, p.types)

              return (
                <div key={p.id} className="contacts-mobile-card" onClick={() => router.push(`/people/${p.id}`)}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div className="contacts-avatar" style={{ background: ac.bg, color: ac.text }}>{initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="contacts-name">{p.name}</span>
                        {typeMeta && (
                          <span className="contacts-type-badge" style={{ background: `${typeMeta.color}18`, color: typeMeta.color, borderColor: `${typeMeta.color}33` }}>
                            {typeMeta.label}
                          </span>
                        )}
                      </div>
                      <div className="contacts-summary" style={{ marginTop: 3 }}><SummaryLine p={p} /></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                        {p.phone && <span>{formatPhoneDisplay(p.phone)}</span>}
                        <span className={stale ? 'contacts-stale' : ''}>
                          {relativeContact(p.last_interaction_at)}
                          {stale && <span style={{ marginLeft: 3 }}>⚠</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="contacts-actions" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
                    {p.phone && (
                      <a href={`tel:${p.phone}`} onClick={e => e.stopPropagation()} className="contacts-action-btn" title="Ligar">
                        <Icon name="phone" size={14} />
                      </a>
                    )}
                    {p.phone && (
                      <a
                        href={buildWaLink(p.phone, `Olá ${p.name.split(' ')[0]}!`)}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="contacts-action-btn contacts-action-wa"
                        title="WhatsApp"
                      >
                        <Icon name="whatsapp" size={14} />
                      </a>
                    )}
                    {p.email && (
                      <a href={`mailto:${p.email}`} onClick={e => e.stopPropagation()} className="contacts-action-btn" title="Email">
                        <Icon name="mail" size={14} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
