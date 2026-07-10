'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Person } from '@/types'
import { CONTACT_TYPES, capacityMeta, type ContactTypeKey } from '@/lib/contacts/constants'
import { EmptyState } from '@/components/ui/EmptyState'
import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'
import { NewContactModal } from '@/components/contacts/NewContactModal'
import { ContactFilters, EMPTY_FILTERS, applyContactFilters, type ContactFilterState } from '@/components/contacts/ContactFilters'

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

function cap(s?: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function PreviewLine({ p }: { p: Person }) {
  const dot = <span style={{ color: 'var(--border-strong)' }}> · </span>
  const t = p.types ?? []
  const dim: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginTop: 4 }

  if (t.includes('vendedor')) {
    const stale = p.details?.is_active_seller && (() => { const d = daysSince(p.last_interaction_at); return d == null || d > 10 })()
    return (
      <div style={{ ...dim, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>
          {p.details?.selling_property || '—'}
          {p.details?.selling_zone && <>{dot}{p.details.selling_zone}</>}
          {p.details?.selling_price != null && <>{dot}€{p.details.selling_price.toLocaleString('pt-PT')}</>}
          {dot}Último contacto: {relativeContact(p.last_interaction_at)}
        </span>
        {stale && (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#EF4444', background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '2px 8px' }}>
            ⚠ Sem contacto há +10 dias
          </span>
        )}
      </div>
    )
  }

  if (t.includes('comprador') || t.includes('investidor')) {
    return (
      <div style={dim}>
        {p.details?.looking_for || '—'}
        {p.details?.search_zone && <>{dot}{p.details.search_zone}</>}
        {capacityMeta(p.financial_capacity)?.label && <>{dot}{capacityMeta(p.financial_capacity)?.label}</>}
        {p.details?.temperature && <>{dot}{cap(p.details.temperature)}</>}
      </div>
    )
  }

  if (t.includes('consultor')) {
    return (
      <div style={dim}>
        {p.details?.agency_name || '—'}
        {p.details?.working_zone && <>{dot}{p.details.working_zone}</>}
        {(p.email || p.phone) && <>{dot}{p.email ?? p.phone}</>}
      </div>
    )
  }

  if (t.includes('servico')) {
    return (
      <div style={dim}>
        {p.details?.service_type || '—'}
        {p.details?.working_zone && <>{dot}{p.details.working_zone}</>}
        {(p.email || p.phone) && <>{dot}{p.email ?? p.phone}</>}
      </div>
    )
  }

  return <div style={dim}>{p.email ?? p.phone ?? '—'}</div>
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
        (p.email ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [people, filters, activeTypes, search])

  const filtering = search.trim().length > 0 || activeTypes.length > 0 || JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <div className="page-enter">
      {showModal && (
        <NewContactModal
          onClose={() => setShowModal(false)}
          onCreated={fetchPeople}
        />
      )}

      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20 }}>Contactos</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{visible.length} contactos</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">+ Novo Contacto</button>
      </div>

      <div className="page-pad" style={{ padding: '20px 32px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => setActiveTypes([])}
            style={{
              fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
              background: activeTypes.length === 0 ? 'var(--gold-glow)' : 'var(--surface)',
              color: activeTypes.length === 0 ? 'var(--gold)' : 'var(--muted)',
              border: activeTypes.length === 0 ? '1px solid var(--gold)' : '1px solid var(--border)',
            }}
          >
            Todos
          </button>
          {CONTACT_TYPES.map(meta => {
            const active = activeTypes.includes(meta.key)
            return (
              <button
                key={meta.key}
                onClick={() => toggleType(meta.key)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                  background: active ? `${meta.color}18` : 'var(--surface)',
                  color: active ? meta.color : 'var(--muted)',
                  border: active ? `1px solid ${meta.color}55` : '1px solid var(--border)',
                }}
              >
                {meta.plural}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            className="input"
            placeholder="Pesquisar por nome, telefone ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <button onClick={() => setShowFilters(s => !s)} className="btn btn-ghost">Filtros</button>
        </div>

        {showFilters && (
          <ContactFilters value={filters} onChange={setFilters} onClose={() => setShowFilters(false)} />
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />
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
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visible.map(p => (
              <div
                key={p.id}
                className="card"
                onClick={() => router.push(`/people/${p.id}`)}
                style={{ padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
              >
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{p.name}</div>
                    <ContactTypeChips types={p.types ?? []} />
                  </div>
                  <PreviewLine p={p} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
