'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Property, PropertyType, PropertyStatus } from '@/types'

type PropertyWithLeads = Property & { leads?: { id: string }[] }

const TYPES: { value: PropertyType; label: string }[] = [
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'moradia', label: 'Moradia' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'loja', label: 'Loja' },
  { value: 'escritorio', label: 'Escritório' },
  { value: 'armazem', label: 'Armazém' },
  { value: 'outro', label: 'Outro' },
]

const STATUSES: { value: PropertyStatus; label: string }[] = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'reservado', label: 'Reservado' },
  { value: 'vendido', label: 'Vendido' },
  { value: 'arrendado', label: 'Arrendado' },
]

const STATUS_COLORS: Record<PropertyStatus, string> = {
  disponivel: '#10B981',
  reservado: '#F59E0B',
  vendido: '#8B5CF6',
  arrendado: '#3B82F6',
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<PropertyWithLeads[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', type: 'apartamento' as PropertyType, price: '', area_m2: '', typology: '', zone: '', address: '', bedrooms: '', bathrooms: '' })
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchProperties = useCallback(async () => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (filterType) params.set('type', filterType)
    if (filterStatus) params.set('status', filterStatus)
    try {
      const res = await fetch(`/api/properties?${params}`)
      if (!res.ok) throw new Error()
      setProperties(await res.json())
    } catch { setProperties([]) }
    finally { setLoading(false) }
  }, [debouncedSearch, filterType, filterStatus])

  useEffect(() => { fetchProperties() }, [fetchProperties])

  async function createProperty(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price: form.price ? Number(form.price) : null,
          area_m2: form.area_m2 ? Number(form.area_m2) : null,
          bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
          bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
          typology: form.typology || null,
          zone: form.zone || null,
          address: form.address || null,
        }),
      })
      if (res.ok) {
        setForm({ title: '', type: 'apartamento', price: '', area_m2: '', typology: '', zone: '', address: '', bedrooms: '', bathrooms: '' })
        setShowForm(false)
        fetchProperties()
      }
    } finally { setCreating(false) }
  }

  const inputStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20 }}>Imóveis</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{properties.length} imóveis</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>+ Novo Imóvel</button>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div className="font-display" style={{ fontSize: 18 }}>Novo Imóvel</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={createProperty} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input style={{ ...inputStyle, width: '100%' }} placeholder="Título *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <select style={{ ...inputStyle, width: '100%' }} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as PropertyType }))}>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input style={{ ...inputStyle, width: '100%' }} placeholder="Tipologia (ex: T3)" value={form.typology} onChange={e => setForm(p => ({ ...p, typology: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input type="number" style={{ ...inputStyle, width: '100%' }} placeholder="Preço (€)" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
                <input type="number" style={{ ...inputStyle, width: '100%' }} placeholder="Área (m²)" value={form.area_m2} onChange={e => setForm(p => ({ ...p, area_m2: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input type="number" style={{ ...inputStyle, width: '100%' }} placeholder="Quartos" value={form.bedrooms} onChange={e => setForm(p => ({ ...p, bedrooms: e.target.value }))} />
                <input type="number" style={{ ...inputStyle, width: '100%' }} placeholder="Casas de banho" value={form.bathrooms} onChange={e => setForm(p => ({ ...p, bathrooms: e.target.value }))} />
              </div>
              <input style={{ ...inputStyle, width: '100%' }} placeholder="Zona" value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} />
              <input style={{ ...inputStyle, width: '100%' }} placeholder="Morada" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, ...inputStyle, textAlign: 'center' as const, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={creating} style={{ flex: 1, background: 'var(--gold)', border: 'none', borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 600, color: '#0D0D0F', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>{creating ? 'A criar...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ padding: '20px 32px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <input placeholder="Pesquisar por título, referência ou morada..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <select style={{ ...inputStyle, width: 140 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Todos os tipos</option>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select style={{ ...inputStyle, width: 140 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Ref', 'Título', 'Tipo', 'Tipologia', 'Preço', 'Área', 'Zona', 'Status', 'Leads'].map(h => (
                  <th key={h} style={{ textAlign: 'left' as const, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center' as const, color: 'var(--muted)', fontSize: 13 }}>A carregar...</td></tr>}
              {!loading && properties.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center' as const, color: 'var(--muted)', fontSize: 13 }}>Nenhum imóvel encontrado.</td></tr>}
              {properties.map(p => {
                const statusColor = STATUS_COLORS[p.status]
                return (
                  <tr key={p.id} onClick={() => router.push(`/properties/${p.id}`)} style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{p.reference ?? '—'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.title}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{TYPES.find(t => t.value === p.type)?.label ?? p.type}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{p.typology ?? '—'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{p.price ? `€${p.price.toLocaleString('pt-PT')}` : '—'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{p.area_m2 ? `${p.area_m2}m²` : '—'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{p.zone ?? '—'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${statusColor}22`, color: statusColor, fontWeight: 500 }}>
                        {STATUSES.find(s => s.value === p.status)?.label ?? p.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{p.leads?.length ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
