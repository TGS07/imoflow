# Properties Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full real estate property catalog where each property can be associated with multiple leads/deals.

**Architecture:** New `properties` table with RLS. Properties API with filtering. Property list/detail pages. Leads updated to reference properties via `property_id`. Existing components updated to show property info.

**Tech Stack:** Next.js 16, React 19, Supabase (PostgreSQL + RLS), TypeScript

---

## File Structure

### New Files
- `supabase/migrations/20260530_properties.sql`
- `app/api/properties/route.ts`
- `app/api/properties/[id]/route.ts`
- `app/(app)/properties/page.tsx`
- `app/(app)/properties/[id]/page.tsx`

### Modified Files
- `types/index.ts`
- `app/api/leads/route.ts`
- `app/api/leads/[id]/route.ts`
- `components/layout/Sidebar.tsx`
- `components/leads/NewLeadModal.tsx`
- `components/pipeline/KanbanBoard.tsx`
- `app/(app)/leads/[id]/page.tsx`

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260530_properties.sql`

- [ ] **Step 1: Create migration file**

```sql
-- PROPERTIES
create table public.properties (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  reference   text,
  title       text not null,
  type        text not null check (type in ('apartamento','moradia','terreno','loja','escritorio','armazem','outro')),
  status      text not null default 'disponivel' check (status in ('disponivel','reservado','vendido','arrendado')),
  price       numeric,
  area_m2     numeric,
  typology    text,
  bedrooms    int,
  bathrooms   int,
  floor       text,
  condition   text check (condition in ('novo','usado','renovado','em_construcao')),
  address     text,
  city        text,
  zone        text,
  postal_code text,
  latitude    numeric,
  longitude   numeric,
  description text,
  features    jsonb default '[]',
  photos      jsonb default '[]',
  notes       text,
  created_at  timestamptz not null default now()
);

create index properties_agency_idx on properties(agency_id);
create index properties_status_idx on properties(agency_id, status);

-- ADD FK TO LEADS
alter table public.leads add column property_id uuid references public.properties(id) on delete set null;

-- RLS for properties
alter table public.properties enable row level security;
create policy "properties: own agency" on public.properties
  for all using (agency_id = public.get_my_agency_id());
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260530_properties.sql
git commit -m "feat: add properties table with RLS"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add Property types and update Lead**

Add after the Organization type (line 74):

```typescript
export type PropertyType = 'apartamento' | 'moradia' | 'terreno' | 'loja' | 'escritorio' | 'armazem' | 'outro'
export type PropertyStatus = 'disponivel' | 'reservado' | 'vendido' | 'arrendado'
export type PropertyCondition = 'novo' | 'usado' | 'renovado' | 'em_construcao'

export type Property = {
  id: string
  agency_id: string
  reference: string | null
  title: string
  type: PropertyType
  status: PropertyStatus
  price: number | null
  area_m2: number | null
  typology: string | null
  bedrooms: number | null
  bathrooms: number | null
  floor: string | null
  condition: PropertyCondition | null
  address: string | null
  city: string | null
  zone: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  description: string | null
  features: string[]
  photos: string[]
  notes: string | null
  created_at: string
}
```

Add to the Lead type (after `organization_id: string | null`):

```typescript
  property_id: string | null
```

Add to the Lead type (after `organizations?: Organization`):

```typescript
  properties?: Property
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add Property types; update Lead with property_id"
```

---

## Task 3: Properties API

**Files:**
- Create: `app/api/properties/route.ts`
- Create: `app/api/properties/[id]/route.ts`

- [ ] **Step 1: Create GET/POST for properties**

`app/api/properties/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const zone = searchParams.get('zone')
  const priceMin = searchParams.get('price_min')
  const priceMax = searchParams.get('price_max')

  let query = supabase
    .from('properties')
    .select('*, leads(id)')
    .order('created_at', { ascending: false })

  if (search) {
    const term = search.replace(/[%_\\]/g, '\\$&')
    query = query.or(`title.ilike.%${term}%,reference.ilike.%${term}%,address.ilike.%${term}%`)
  }
  if (type) query = query.eq('type', type)
  if (status) query = query.eq('status', status)
  if (zone) {
    const term = zone.replace(/[%_\\]/g, '\\$&')
    query = query.ilike('zone', `%${term}%`)
  }
  if (priceMin) query = query.gte('price', Number(priceMin))
  if (priceMax) query = query.lte('price', Number(priceMax))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('properties')
    .insert({ ...body, agency_id: profile.agency_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create GET/PATCH/DELETE for single property**

`app/api/properties/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('properties')
    .select('*, leads(id, name, stage_id, deal_value, person_id, created_at, pipeline_stages(name, color), people(name))')
    .eq('id', id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('properties')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/properties/
git commit -m "feat: add properties CRUD API with filters"
```

---

## Task 4: Update Leads API for property_id

**Files:**
- Modify: `app/api/leads/route.ts`
- Modify: `app/api/leads/[id]/route.ts`

- [ ] **Step 1: Update leads list API select**

In `app/api/leads/route.ts`, change the select string from:

```
'*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost), people(id, name, email, phone), organizations(id, name)'
```

to:

```
'*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost), people(id, name, email, phone), organizations(id, name), properties(id, reference, title, price, type)'
```

- [ ] **Step 2: Update lead detail API select**

In `app/api/leads/[id]/route.ts`, change the select string from:

```
'*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost), custom_field_values(id, field_id, value_text, value_number, value_date, value_json), people(id, name, email, phone), organizations(id, name)'
```

to:

```
'*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost), custom_field_values(id, field_id, value_text, value_number, value_date, value_json), people(id, name, email, phone), organizations(id, name), properties(id, reference, title, price, type, status, zone, typology, area_m2)'
```

- [ ] **Step 3: Commit**

```bash
git add app/api/leads/route.ts app/api/leads/\[id\]/route.ts
git commit -m "feat: join properties in leads API"
```

---

## Task 5: Properties List Page

**Files:**
- Create: `app/(app)/properties/page.tsx`

- [ ] **Step 1: Create properties list page**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/properties/page.tsx
git commit -m "feat: properties list page with filters and create modal"
```

---

## Task 6: Property Detail Page

**Files:**
- Create: `app/(app)/properties/[id]/page.tsx`

- [ ] **Step 1: Create property detail page**

```typescript
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
    description: '', notes: '', features: '' , photos: ''
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/properties" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}>← Imóveis</Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{property.title}</span>
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

      <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
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
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/properties/\[id\]/page.tsx
git commit -m "feat: property detail page with editable info and deals list"
```

---

## Task 7: Update Sidebar

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Imóveis nav item**

Add after the organizations entry in the navItems array:

```typescript
{ href: '/properties', icon: '🏠', label: 'Imóveis', section: 'Principal' },
```

The navItems array should look like:
```typescript
const navItems = [
  { href: '/dashboard', icon: '▦', label: 'Dashboard', section: 'Principal' },
  { href: '/leads', icon: '◎', label: 'Leads', section: 'Principal' },
  { href: '/pipeline', icon: '◈', label: 'Pipeline', section: 'Principal' },
  { href: '/people', icon: '👤', label: 'Pessoas', section: 'Principal' },
  { href: '/organizations', icon: '🏢', label: 'Organizações', section: 'Principal' },
  { href: '/properties', icon: '🏠', label: 'Imóveis', section: 'Principal' },
  { href: '/settings/pipeline', icon: '⚙', label: 'Configurações', section: 'Sistema' },
]
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: add properties link to sidebar"
```

---

## Task 8: Update NewLeadModal with Property Selection

**Files:**
- Modify: `components/leads/NewLeadModal.tsx`

- [ ] **Step 1: Add property autocomplete**

Add `Property` to the import from `@/types`:
```typescript
import { LeadSource, CustomField, Person, Organization, Property } from '@/types'
```

Add property state after the organization autocomplete state:
```typescript
  // Property autocomplete
  const [propSearch, setPropSearch] = useState('')
  const [propResults, setPropResults] = useState<Property[]>([])
  const [selectedProp, setSelectedProp] = useState<Property | null>(null)
  const [showPropDropdown, setShowPropDropdown] = useState(false)
  const propRef = useRef<HTMLDivElement>(null)
```

Add property search effect after the organization search effect:
```typescript
  // Property search
  useEffect(() => {
    if (!propSearch || selectedProp) { setPropResults([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/properties?search=${encodeURIComponent(propSearch)}`)
      if (res.ok) setPropResults(await res.json())
    }, 300)
    return () => clearTimeout(timer)
  }, [propSearch, selectedProp])
```

Add to the outside click handler:
```typescript
      if (propRef.current && !propRef.current.contains(e.target as Node)) setShowPropDropdown(false)
```

Add `property_id: selectedProp?.id ?? null` to the POST body (next to `organization_id`).

Add the property autocomplete field in the JSX after the organization autocomplete and before the name field:

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/leads/NewLeadModal.tsx
git commit -m "feat: property autocomplete in new lead modal"
```

---

## Task 9: Update Lead Detail Page

**Files:**
- Modify: `app/(app)/leads/[id]/page.tsx`

- [ ] **Step 1: Add property badge**

After the organizations badge block (the `{lead.organizations && (` block), add:

```jsx
              {lead.properties && (
                <Link href={`/properties/${lead.properties.id}`} style={{ textDecoration: 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: 'rgba(16,185,129,0.1)', color: '#10B981', cursor: 'pointer' }}>
                    🏠 {lead.properties.reference ? `${lead.properties.reference} — ` : ''}{lead.properties.title}
                  </span>
                </Link>
              )}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/leads/\[id\]/page.tsx
git commit -m "feat: show property link in lead detail"
```

---

## Task 10: Update KanbanBoard Cards

**Files:**
- Modify: `components/pipeline/KanbanBoard.tsx`

- [ ] **Step 1: Show property info on kanban cards**

After the people name line (`{lead.people?.name && lead.people.name !== lead.name && (` block), add:

```jsx
        {lead.properties && (
          <div style={{ fontSize: 10, color: '#10B981', marginBottom: 4, opacity: 0.8 }}>🏠 {lead.properties.reference ?? lead.properties.title}</div>
        )}
```

- [ ] **Step 2: Commit**

```bash
git add components/pipeline/KanbanBoard.tsx
git commit -m "feat: show property on kanban cards"
```

---

## Task 11: Verify Build

- [ ] **Step 1: Run build**

```bash
npx next build
```

- [ ] **Step 2: Fix any errors**

- [ ] **Step 3: Final commit if needed**
