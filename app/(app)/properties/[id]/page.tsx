'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Property, PropertyType, PropertyStatus, PropertyCondition } from '@/types'

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

const STATUS_COLORS: Record<PropertyStatus, string> = {
  disponivel: '#10B981',
  reservado: '#F59E0B',
  vendido: '#8B5CF6',
  arrendado: '#3B82F6',
}

type LeadSummary = {
  id: string
  name: string
  stage_id: string
  deal_value: number | null
  person_id: string | null
  created_at: string
  pipeline_stages?: { name: string; color: string }
  people?: { name: string }
}

type PropertyDetail = Property & { leads?: LeadSummary[] }

export default function PropertyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    title: '', reference: '', type: 'apartamento' as PropertyType, status: 'disponivel' as PropertyStatus,
    price: '', area_m2: '', typology: '', bedrooms: '', bathrooms: '', floor: '',
    condition: '' as string, address: '', city: '', zone: '', postal_code: '',
    description: '', notes: '', features: '', photos: ''
  })

  const fetchProperty = useCallback(async () => {
    const res = await fetch(`/api/properties/${id}`)
    if (!res.ok) return
    const data: PropertyDetail = await res.json()
    setProperty(data)
    setForm({
      title: data.title, reference: data.reference ?? '', type: data.type, status: data.status,
      price: data.price?.toString() ?? '', area_m2: data.area_m2?.toString() ?? '',
      typology: data.typology ?? '', bedrooms: data.bedrooms?.toString() ?? '',
      bathrooms: data.bathrooms?.toString() ?? '', floor: data.floor ?? '',
      condition: data.condition ?? '', address: data.address ?? '', city: data.city ?? '',
      zone: data.zone ?? '', postal_code: data.postal_code ?? '',
      description: data.description ?? '', notes: data.notes ?? '',
      features: (data.features ?? []).join(', '),
      photos: (data.photos ?? []).join('\n'),
    })
  }, [id])

  useEffect(() => { fetchProperty() }, [fetchProperty])

  async function save() {
    const res = await fetch(`/api/properties/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        reference: form.reference || null,
        type: form.type,
        status: form.status,
        price: form.price ? Number(form.price) : null,
        area_m2: form.area_m2 ? Number(form.area_m2) : null,
        typology: form.typology || null,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        floor: form.floor || null,
        condition: form.condition || null,
        address: form.address || null,
        city: form.city || null,
        zone: form.zone || null,
        postal_code: form.postal_code || null,
        description: form.description || null,
        notes: form.notes || null,
        features: form.features ? form.features.split(',').map(f => f.trim()).filter(Boolean) : [],
        photos: form.photos ? form.photos.split('\n').map(u => u.trim()).filter(Boolean) : [],
      }),
    })
    if (res.ok) { setEditing(false); fetchProperty() }
  }

  async function deleteProperty() {
    if (!confirm('Eliminar este imóvel? Os leads associados não serão eliminados.')) return
    await fetch(`/api/properties/${id}`, { method: 'DELETE' })
    router.push('/properties')
  }

  if (!property) return <div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>A carregar...</div>

  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif', width: '100%' }
  const labelStyle = { fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }
  const statusColor = STATUS_COLORS[property.status]
  const totalDeals = property.leads?.length ?? 0

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <Link href="/properties" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13, flexShrink: 0 }}>← Imóveis</Link>
          <span style={{ color: 'var(--border)', flexShrink: 0 }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{property.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!editing ? (
            <button onClick={() => setEditing(true)} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, color: 'var(--text)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Editar</button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Cancelar</button>
              <button onClick={save} style={{ background: 'var(--gold)', border: 'none', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, fontWeight: 600, color: '#0D0D0F', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Guardar</button>
            </>
          )}
          <button onClick={deleteProperty} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0 14px', height: 32, fontSize: 12, color: '#EF4444', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>Eliminar</button>
        </div>
      </div>

      <div className="two-col-grid" style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: Property Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'linear-gradient(135deg, #10B981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏠</div>
              <div style={{ flex: 1 }}>
                {editing ? (
                  <input style={inputStyle} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                ) : (
                  <div className="font-display" style={{ fontSize: 18 }}>{property.title}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${statusColor}22`, color: statusColor, fontWeight: 500 }}>
                    {STATUSES.find(s => s.value === property.status)?.label}
                  </span>
                  {property.reference && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{property.reference}</span>}
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{totalDeals} negócio{totalDeals !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {editing && (
                <>
                  <div><div style={labelStyle}>Referência</div><input style={inputStyle} value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} /></div>
                  <div><div style={labelStyle}>Tipo</div><select style={inputStyle} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as PropertyType }))}>{TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                  <div><div style={labelStyle}>Status</div><select style={inputStyle} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as PropertyStatus }))}>{STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                  <div><div style={labelStyle}>Condição</div><select style={inputStyle} value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}><option value="">—</option>{CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
                </>
              )}
              {!editing && (
                <>
                  <div><div style={labelStyle}>Tipo</div><div style={{ fontSize: 13 }}>{TYPES.find(t => t.value === property.type)?.label}</div></div>
                  <div><div style={labelStyle}>Condição</div><div style={{ fontSize: 13, color: property.condition ? 'var(--text)' : 'var(--muted)' }}>{property.condition ? CONDITIONS.find(c => c.value === property.condition)?.label : '—'}</div></div>
                </>
              )}
              <div>
                <div style={labelStyle}>Preço</div>
                {editing ? <input type="number" style={inputStyle} value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} /> : <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--gold)' }}>{property.price ? `€${property.price.toLocaleString('pt-PT')}` : '—'}</div>}
              </div>
              <div>
                <div style={labelStyle}>Área</div>
                {editing ? <input type="number" style={inputStyle} value={form.area_m2} onChange={e => setForm(p => ({ ...p, area_m2: e.target.value }))} /> : <div style={{ fontSize: 13 }}>{property.area_m2 ? `${property.area_m2} m²` : '—'}</div>}
              </div>
              <div>
                <div style={labelStyle}>Tipologia</div>
                {editing ? <input style={inputStyle} value={form.typology} onChange={e => setForm(p => ({ ...p, typology: e.target.value }))} /> : <div style={{ fontSize: 13, color: property.typology ? 'var(--text)' : 'var(--muted)' }}>{property.typology ?? '—'}</div>}
              </div>
              <div>
                <div style={labelStyle}>Quartos</div>
                {editing ? <input type="number" style={inputStyle} value={form.bedrooms} onChange={e => setForm(p => ({ ...p, bedrooms: e.target.value }))} /> : <div style={{ fontSize: 13, color: property.bedrooms != null ? 'var(--text)' : 'var(--muted)' }}>{property.bedrooms ?? '—'}</div>}
              </div>
              <div>
                <div style={labelStyle}>Casas de Banho</div>
                {editing ? <input type="number" style={inputStyle} value={form.bathrooms} onChange={e => setForm(p => ({ ...p, bathrooms: e.target.value }))} /> : <div style={{ fontSize: 13, color: property.bathrooms != null ? 'var(--text)' : 'var(--muted)' }}>{property.bathrooms ?? '—'}</div>}
              </div>
              <div>
                <div style={labelStyle}>Andar</div>
                {editing ? <input style={inputStyle} value={form.floor} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))} /> : <div style={{ fontSize: 13, color: property.floor ? 'var(--text)' : 'var(--muted)' }}>{property.floor ?? '—'}</div>}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[
                { label: 'Morada', key: 'address' as const },
                { label: 'Cidade', key: 'city' as const },
                { label: 'Zona', key: 'zone' as const },
                { label: 'Código Postal', key: 'postal_code' as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <div style={labelStyle}>{label}</div>
                  {editing ? <input style={inputStyle} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} /> : <div style={{ fontSize: 13, color: property[key] ? 'var(--text)' : 'var(--muted)' }}>{property[key] ?? '—'}</div>}
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Características</div>
              {editing ? (
                <input style={inputStyle} value={form.features} onChange={e => setForm(p => ({ ...p, features: e.target.value }))} placeholder="garagem, piscina, varanda (separado por vírgulas)" />
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {property.features && property.features.length > 0 ? property.features.map(f => (
                    <span key={f} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>{f}</span>
                  )) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Descrição</div>
              {editing ? <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' as const }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /> : <div style={{ fontSize: 13, color: property.description ? 'var(--text)' : 'var(--muted)', whiteSpace: 'pre-wrap' }}>{property.description ?? '—'}</div>}
            </div>

            <div>
              <div style={labelStyle}>Fotos (URLs)</div>
              {editing ? <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const }} value={form.photos} onChange={e => setForm(p => ({ ...p, photos: e.target.value }))} placeholder="Uma URL por linha" /> : (
                property.photos && property.photos.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {property.photos.map((url, i) => (
                      <img key={i} src={url} alt={`Foto ${i + 1}`} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                    ))}
                  </div>
                ) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sem fotos</span>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={labelStyle}>Notas</div>
              {editing ? <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /> : <div style={{ fontSize: 13, color: property.notes ? 'var(--text)' : 'var(--muted)', whiteSpace: 'pre-wrap' }}>{property.notes ?? '—'}</div>}
            </div>
          </div>
        </div>

        {/* Right: Deals */}
        <div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div className="font-display" style={{ fontSize: 15, marginBottom: 16 }}>Negócios</div>

            {(!property.leads || property.leads.length === 0) ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Nenhum negócio associado.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {property.leads.map(lead => {
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
                            {lead.people?.name && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{lead.people.name}</span>}
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
