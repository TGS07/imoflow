# Contacts & Organizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate People (contacts) from Leads (deals), add Organizations entity, new CRUD pages and APIs.

**Architecture:** New `people` and `organizations` tables with RLS. Migration creates people from existing leads. New API endpoints, list/detail pages, and updates to existing lead components.

**Tech Stack:** Next.js 16, React 19, Supabase (PostgreSQL + RLS), TypeScript

---

## File Structure

### New Files
- `supabase/migrations/20260529_contacts_organizations.sql`
- `app/api/people/route.ts`
- `app/api/people/[id]/route.ts`
- `app/api/organizations/route.ts`
- `app/api/organizations/[id]/route.ts`
- `app/(app)/people/page.tsx`
- `app/(app)/people/[id]/page.tsx`
- `app/(app)/organizations/page.tsx`
- `app/(app)/organizations/[id]/page.tsx`

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
- Create: `supabase/migrations/20260529_contacts_organizations.sql`

- [ ] **Step 1: Create migration file**

```sql
-- PEOPLE
create table public.people (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create index people_agency_idx on people(agency_id);

-- ORGANIZATIONS
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  website text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create index organizations_agency_idx on organizations(agency_id);

-- ADD FK COLUMNS TO LEADS
alter table public.leads add column person_id uuid references public.people(id) on delete set null;
alter table public.leads add column organization_id uuid references public.organizations(id) on delete set null;

-- MIGRATE: Create people from existing leads
do $$
declare
  lead_row record;
  new_person_id uuid;
begin
  for lead_row in select id, agency_id, name, email, phone from public.leads loop
    insert into public.people (agency_id, name, email, phone)
    values (lead_row.agency_id, lead_row.name, lead_row.email, lead_row.phone)
    returning id into new_person_id;

    update public.leads set person_id = new_person_id where id = lead_row.id;
  end loop;
end $$;

-- RLS for people
alter table public.people enable row level security;
create policy "people: own agency" on public.people
  for all using (agency_id = public.get_my_agency_id());

-- RLS for organizations
alter table public.organizations enable row level security;
create policy "organizations: own agency" on public.organizations
  for all using (agency_id = public.get_my_agency_id());
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260529_contacts_organizations.sql
git commit -m "feat: add people and organizations tables with data migration"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add Person and Organization types, update Lead**

Add after the CustomFieldValue type:

```typescript
export type Person = {
  id: string
  agency_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export type Organization = {
  id: string
  agency_id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  notes: string | null
  created_at: string
}
```

Add to the Lead type:
```typescript
  person_id: string | null
  organization_id: string | null
  people?: Person
  organizations?: Organization
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add Person, Organization types; update Lead with person_id"
```

---

## Task 3: People API

**Files:**
- Create: `app/api/people/route.ts`
- Create: `app/api/people/[id]/route.ts`

- [ ] **Step 1: Create GET/POST for people**

`app/api/people/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')

  let query = supabase
    .from('people')
    .select('*, leads(id, name, stage_id, deal_value, pipeline_stages(name, color))')
    .order('created_at', { ascending: false })

  if (search) {
    const term = search.replace(/[%_\\]/g, '\\$&')
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
  }

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
    .from('people')
    .insert({ ...body, agency_id: profile.agency_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create GET/PATCH/DELETE for single person**

`app/api/people/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('people')
    .select('*, leads(id, name, stage_id, deal_value, expected_close_date, created_at, pipeline_stages(name, color, is_won, is_lost))')
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
    .from('people')
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

  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/people/
git commit -m "feat: add people CRUD API endpoints"
```

---

## Task 4: Organizations API

**Files:**
- Create: `app/api/organizations/route.ts`
- Create: `app/api/organizations/[id]/route.ts`

- [ ] **Step 1: Create GET/POST for organizations**

`app/api/organizations/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')

  let query = supabase
    .from('organizations')
    .select('*, leads(id)')
    .order('created_at', { ascending: false })

  if (search) {
    const term = search.replace(/[%_\\]/g, '\\$&')
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`)
  }

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
    .from('organizations')
    .insert({ ...body, agency_id: profile.agency_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create GET/PATCH/DELETE for single organization**

`app/api/organizations/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('organizations')
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
    .from('organizations')
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

  const { error } = await supabase.from('organizations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/organizations/
git commit -m "feat: add organizations CRUD API endpoints"
```

---

## Task 5: Update Leads API for person_id and organization_id

**Files:**
- Modify: `app/api/leads/route.ts`
- Modify: `app/api/leads/[id]/route.ts`

- [ ] **Step 1: Update leads list API to join people and organizations**

In `app/api/leads/route.ts`, update the GET select to include people and organizations:

Change the select in GET from:
```
'*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost)'
```
to:
```
'*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost), people(id, name, email, phone), organizations(id, name)'
```

- [ ] **Step 2: Update lead detail API to join people and organizations**

In `app/api/leads/[id]/route.ts`, update the GET select to include people and organizations:

Change the select in GET from:
```
'*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost), custom_field_values(id, field_id, value_text, value_number, value_date, value_json)'
```
to:
```
'*, users(name, avatar_initials), pipeline_stages(id, name, color, position, probability, is_won, is_lost), custom_field_values(id, field_id, value_text, value_number, value_date, value_json), people(id, name, email, phone), organizations(id, name)'
```

- [ ] **Step 3: Commit**

```bash
git add app/api/leads/route.ts app/api/leads/\[id\]/route.ts
git commit -m "feat: join people and organizations in leads API"
```

---

## Task 6: People List Page

**Files:**
- Create: `app/(app)/people/page.tsx`

- [ ] **Step 1: Create people list page**

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Person } from '@/types'

type PersonWithLeads = Person & { leads?: { id: string }[] }

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonWithLeads[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchPeople = useCallback(async () => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    try {
      const res = await fetch(`/api/people?${params}`)
      if (!res.ok) throw new Error()
      setPeople(await res.json())
    } catch { setPeople([]) }
    finally { setLoading(false) }
  }, [debouncedSearch])

  useEffect(() => { fetchPeople() }, [fetchPeople])

  async function createPerson(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/people', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { setForm({ name: '', email: '', phone: '' }); setShowForm(false); fetchPeople() }
    } finally { setCreating(false) }
  }

  const inputStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20 }}>Pessoas</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{people.length} contactos</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>+ Nova Pessoa</button>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div className="font-display" style={{ fontSize: 18 }}>Nova Pessoa</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={createPerson} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input style={{ ...inputStyle, width: '100%' }} placeholder="Nome *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              <input style={{ ...inputStyle, width: '100%' }} type="email" placeholder="Email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              <input style={{ ...inputStyle, width: '100%' }} placeholder="Telefone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, ...inputStyle, textAlign: 'center', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={creating} style={{ flex: 1, background: 'var(--gold)', border: 'none', borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 600, color: '#0D0D0F', cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>{creating ? 'A criar...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ padding: '20px 32px' }}>
        <input placeholder="Pesquisar por nome, email ou telefone..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: '100%', marginBottom: 16 }} />
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nome', 'Email', 'Telefone', 'Negocios'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>A carregar...</td></tr>}
              {!loading && people.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Nenhuma pessoa encontrada.</td></tr>}
              {people.map(p => (
                <tr key={p.id} onClick={() => router.push(`/people/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
                        {p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      {p.name}
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{p.email ?? '—'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{p.phone ?? '—'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{p.leads?.length ?? 0}</td>
                </tr>
              ))}
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
git add app/\(app\)/people/page.tsx
git commit -m "feat: people list page with search and create modal"
```

---

## Task 7: Person Detail Page

**Files:**
- Create: `app/(app)/people/[id]/page.tsx`

- [ ] **Step 1: Create person detail page**

This page shows the person's info (editable), their associated deals/leads, and aggregated contact history. Full code provided in the implementation — a client component with:
- Editable fields (name, email, phone, address, notes) with inline save
- List of leads/deals associated with this person (with stage badges and values)
- Button to navigate to each deal
- Delete person button

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/people/\[id\]/page.tsx
git commit -m "feat: person detail page with editable info and deals list"
```

---

## Task 8: Organizations List Page

**Files:**
- Create: `app/(app)/organizations/page.tsx`

- [ ] **Step 1: Create organizations list page**

Same pattern as people list: table with name, email, phone, website, number of deals, search, create modal.

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/organizations/page.tsx
git commit -m "feat: organizations list page with search and create modal"
```

---

## Task 9: Organization Detail Page

**Files:**
- Create: `app/(app)/organizations/[id]/page.tsx`

- [ ] **Step 1: Create organization detail page**

Same pattern as person detail: editable info, list of associated deals with person names.

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/organizations/\[id\]/page.tsx
git commit -m "feat: organization detail page with editable info and deals list"
```

---

## Task 10: Update Sidebar with People and Organizations Links

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add nav items**

Add to the navItems array, in the 'Principal' section:
```typescript
{ href: '/people', icon: '👤', label: 'Pessoas', section: 'Principal' },
{ href: '/organizations', icon: '🏢', label: 'Organizacoes', section: 'Principal' },
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: add people and organizations to sidebar navigation"
```

---

## Task 11: Update NewLeadModal with Person Selection

**Files:**
- Modify: `components/leads/NewLeadModal.tsx`

- [ ] **Step 1: Add person autocomplete to NewLeadModal**

Add a person search/select field at the top of the form:
- Text input that searches `/api/people?search=...` as user types
- Dropdown showing matching people
- Option to "Criar nova pessoa" if no match
- When person selected, auto-fill email/phone from person data
- Send `person_id` in the POST body

Also add an optional organization autocomplete field with similar behavior.

- [ ] **Step 2: Commit**

```bash
git add components/leads/NewLeadModal.tsx
git commit -m "feat: person and organization selection in new lead modal"
```

---

## Task 12: Update Lead Detail Page with Person Link

**Files:**
- Modify: `app/(app)/leads/[id]/page.tsx`

- [ ] **Step 1: Show person and organization info in lead detail**

In the hero section, after the stage/source badges, show:
- Person name as a clickable link to `/people/[person_id]`
- Organization name (if exists) as a clickable link to `/organizations/[org_id]`

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/leads/\[id\]/page.tsx
git commit -m "feat: show person and organization links in lead detail"
```

---

## Task 13: Update KanbanBoard Cards with Person Name

**Files:**
- Modify: `components/pipeline/KanbanBoard.tsx`

- [ ] **Step 1: Show person name on kanban cards**

In the LeadCard component, if `lead.people?.name` exists and differs from `lead.name`, show it below the lead name in smaller muted text.

- [ ] **Step 2: Commit**

```bash
git add components/pipeline/KanbanBoard.tsx
git commit -m "feat: show person name on kanban cards"
```

---

## Task 14: Verify Build

- [ ] **Step 1: Run build**

```bash
npx next build
```

- [ ] **Step 2: Fix any errors**

- [ ] **Step 3: Final commit if needed**
