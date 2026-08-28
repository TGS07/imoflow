'use client'
import { useState, useEffect, useCallback } from 'react'
import { HelpButton } from '@/components/help/HelpButton'
import { useRouter } from 'next/navigation'
import { Property, PropertyType, PropertyStatus, PropertyCondition } from '@/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { AudioRecorder } from '@/components/shared/AudioRecorder'

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

const CONDITIONS: { value: PropertyCondition; label: string }[] = [
  { value: 'novo', label: 'Novo' },
  { value: 'usado', label: 'Usado' },
  { value: 'renovado', label: 'Renovado' },
  { value: 'em_construcao', label: 'Em Construção' },
]

const ENERGY_CERTIFICATES: { value: string; label: string }[] = [
  { value: 'A+', label: 'A+' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'B-', label: 'B-' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'Isento', label: 'Isento' },
]

const STATUS_COLORS: Record<PropertyStatus, string> = {
  disponivel: '#059669',
  reservado: '#B07D2E',
  vendido: '#2563EB',
  arrendado: '#8B5CF6',
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<PropertyWithLeads[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const emptyForm = {
    title: '', type: 'apartamento' as PropertyType, status: 'disponivel' as PropertyStatus,
    price: '', area_m2: '', typology: '', bedrooms: '', bathrooms: '', floor: '',
    condition: '' as PropertyCondition | '', reference: '',
    area_util_m2: '', construction_year: '', energy_certificate: '', parking_spaces: '', has_elevator: false,
    zone: '', address: '', city: '', postal_code: '',
    description: '', features: '', photos: '', notes: '', idealista_url: '',
  }
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [mode, setMode] = useState<'manual' | 'audio'>('manual')
  const VALID_TYPES = TYPES.map(t => t.value)

  function applyVoice(f: Record<string, unknown>) {
    setForm(p => ({
      ...p,
      title: typeof f.title === 'string' ? f.title : p.title,
      type: typeof f.type === 'string' && VALID_TYPES.includes(f.type as PropertyType) ? f.type as PropertyType : p.type,
      price: typeof f.price === 'number' ? String(f.price) : p.price,
      area_m2: typeof f.area_m2 === 'number' ? String(f.area_m2) : p.area_m2,
      typology: typeof f.typology === 'string' ? f.typology : p.typology,
      zone: typeof f.zone === 'string' ? f.zone : p.zone,
      address: typeof f.address === 'string' ? f.address : p.address,
      bedrooms: typeof f.bedrooms === 'number' ? String(f.bedrooms) : p.bedrooms,
      bathrooms: typeof f.bathrooms === 'number' ? String(f.bathrooms) : p.bathrooms,
      notes: typeof f.notes === 'string' ? f.notes : p.notes,
    }))
    setMode('manual')
  }
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
          title: form.title,
          type: form.type,
          status: form.status,
          price: form.price ? Number(form.price) : null,
          area_m2: form.area_m2 ? Number(form.area_m2) : null,
          bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
          bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
          floor: form.floor || null,
          condition: form.condition || null,
          area_util_m2: form.area_util_m2 ? Number(form.area_util_m2) : null,
          construction_year: form.construction_year ? Number(form.construction_year) : null,
          energy_certificate: form.energy_certificate || null,
          parking_spaces: form.parking_spaces ? Number(form.parking_spaces) : null,
          has_elevator: form.has_elevator,
          reference: form.reference || null,
          typology: form.typology || null,
          zone: form.zone || null,
          address: form.address || null,
          city: form.city || null,
          postal_code: form.postal_code || null,
          description: form.description || null,
          notes: form.notes || null,
          idealista_url: form.idealista_url || null,
          features: form.features ? form.features.split(',').map(s => s.trim()).filter(Boolean) : [],
          photos: form.photos ? form.photos.split('\n').map(s => s.trim()).filter(Boolean) : [],
        }),
      })
      if (res.ok) {
        setForm(emptyForm)
        setShowForm(false)
        fetchProperties()
      }
    } finally { setCreating(false) }
  }

  return (
    <div className="page-enter">
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ width: 520, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="font-display" style={{ fontSize: 18 }}>Novo Imóvel</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['manual', 'audio'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`chip${mode === m ? ' active' : ''}`}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, justifyContent: 'center',
                  }}
                >
                  {m === 'manual' ? '✍ Manual' : '🎙 Áudio'}
                </button>
              ))}
            </div>
            {mode === 'audio' && <AudioRecorder entity="property" onExtracted={applyVoice} hint="Descreve o imóvel em voz alta (título, tipo, preço, área, tipologia, zona e qualquer detalhe extra) e confirma os dados a seguir." />}
            {mode === 'manual' && (
            <form onSubmit={createProperty} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="input" placeholder="Título *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as PropertyType }))}>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select className="input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as PropertyStatus }))}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input className="input" placeholder="Tipologia (ex: T3)" value={form.typology} onChange={e => setForm(p => ({ ...p, typology: e.target.value }))} />
                <input className="input" placeholder="Referência" value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input type="number" className="input" placeholder="Preço (€)" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
                <input type="number" className="input" placeholder="Área (m²)" value={form.area_m2} onChange={e => setForm(p => ({ ...p, area_m2: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <input type="number" className="input" placeholder="Quartos" value={form.bedrooms} onChange={e => setForm(p => ({ ...p, bedrooms: e.target.value }))} />
                <input type="number" className="input" placeholder="WC" value={form.bathrooms} onChange={e => setForm(p => ({ ...p, bathrooms: e.target.value }))} />
                <input className="input" placeholder="Andar" value={form.floor} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))} />
              </div>
              <select className="input" value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value as PropertyCondition | '' }))}>
                <option value="">Condição —</option>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>

              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Detalhes adicionais</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input type="number" className="input" placeholder="Área útil (m²)" value={form.area_util_m2} onChange={e => setForm(p => ({ ...p, area_util_m2: e.target.value }))} />
                <input type="number" className="input" placeholder="Ano de construção" value={form.construction_year} onChange={e => setForm(p => ({ ...p, construction_year: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <select className="input" value={form.energy_certificate} onChange={e => setForm(p => ({ ...p, energy_certificate: e.target.value }))}>
                  <option value="">Certificado energético —</option>
                  {ENERGY_CERTIFICATES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input type="number" className="input" placeholder="Lugares de garagem" value={form.parking_spaces} onChange={e => setForm(p => ({ ...p, parking_spaces: e.target.value }))} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.has_elevator} onChange={e => setForm(p => ({ ...p, has_elevator: e.target.checked }))} />
                Tem elevador
              </label>

              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Localização</div>
              <input className="input" placeholder="Zona" value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} />
              <input className="input" placeholder="Morada" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input className="input" placeholder="Cidade" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                <input className="input" placeholder="Código postal" value={form.postal_code} onChange={e => setForm(p => ({ ...p, postal_code: e.target.value }))} />
              </div>

              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Detalhes</div>
              <textarea className="input" placeholder="Descrição" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
              <input className="input" placeholder="Características (garagem, piscina, varanda — separadas por vírgulas)" value={form.features} onChange={e => setForm(p => ({ ...p, features: e.target.value }))} />
              <textarea className="input" placeholder="Notas (luz natural, vista, motivo da venda, etc.)" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }} />

              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Fotos (opcional)</div>
              <textarea className="input" placeholder="URLs das fotos, uma por linha" value={form.photos} onChange={e => setForm(p => ({ ...p, photos: e.target.value }))} rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }} />

              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Idealista</div>
              <input className="input" placeholder="Link do anúncio (https://www.idealista.pt/imovel/...)" value={form.idealista_url} onChange={e => setForm(p => ({ ...p, idealista_url: e.target.value }))} />

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={creating} className="btn btn-primary" style={{ flex: 1 }}>{creating ? 'A criar...' : 'Criar'}</button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20 }}>Imóveis <HelpButton section="properties" /></h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{properties.length} imóveis</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">+ Novo Imóvel</button>
      </div>

      <div className="page-pad" style={{ padding: '20px 32px' }}>
        <div
          className="filter-bar"
          style={{
            display: 'flex', gap: 12, marginBottom: 20, padding: 12,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          }}
        >
          <input className="input" placeholder="Pesquisar por título, referência ou morada..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <select className="input hide-mobile" style={{ width: 160 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Todos os tipos</option>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="input hide-mobile" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {!loading && properties.length === 0 ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            {debouncedSearch || filterType || filterStatus ? (
              <EmptyState illustration="search" title="Nenhum resultado" description="Não encontrámos imóveis com esses critérios. Ajusta a pesquisa ou os filtros." />
            ) : (
              <EmptyState illustration="properties" title="Ainda não tens imóveis" description="O teu catálogo de imóveis aparece aqui. Adiciona o primeiro para o associares a leads e negócios." action={{ label: '+ Novo Imóvel', onClick: () => setShowForm(true) }} />
            )}
          </div>
        ) : (
        <div
          className="stagger"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}
        >
          {loading && [0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="card" style={{ overflow: 'hidden' }}>
              <div className="skeleton" style={{ height: 140 }} />
              <div style={{ padding: 16 }}>
                <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '90%' }} />
              </div>
            </div>
          ))}
          {!loading && properties.map(p => {
            const statusColor = STATUS_COLORS[p.status]
            const statusLabel = STATUSES.find(s => s.value === p.status)?.label ?? p.status
            const typeLabel = TYPES.find(t => t.value === p.type)?.label ?? p.type
            const details = [p.zone, typeLabel, p.area_m2 ? `${p.area_m2}m²` : null, p.bedrooms ? `${p.bedrooms} quartos` : null]
              .filter(Boolean)
              .join(' · ')
            return (
              <div
                key={p.id}
                onClick={() => router.push(`/properties/${p.id}`)}
                className="card card-hover"
                style={{ overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ position: 'relative', height: 140, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
                    <path d="M3 10.5L12 3l9 7.5" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span
                    className="stage-badge"
                    style={{ position: 'absolute', top: 10, left: 10, background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30` }}
                  >
                    {statusLabel}
                  </span>
                  {p.energy_certificate && (
                    <span
                      style={{
                        position: 'absolute', top: 10, right: 10, fontSize: 11, fontWeight: 600,
                        padding: '3px 8px', borderRadius: 999, background: 'var(--surface)',
                        color: 'var(--text)', border: '1px solid var(--border)',
                      }}
                    >
                      Cert. {p.energy_certificate}
                    </span>
                  )}
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{details || '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
                    <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 16 }}>
                      {p.price ? `€${p.price.toLocaleString('pt-PT')}` : '—'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="var(--muted)" strokeWidth="1.5" />
                        <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      {p.leads?.length ?? 0} leads
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        )}
      </div>
    </div>
  )
}
