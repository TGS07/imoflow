# Contactos — CRM central de contactos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a secção "Pessoas" na base central de **Contactos** (segmentada por Vendedor/Comprador/Investidor/Serviços, com cores, filtros avançados, capacidade financeira, histórico de interações, notas), ligar Leads→Contactos com origem, enriquecer Imóveis (vendedor, visitas, email de fecho) e criar contactos por áudio.

**Architecture:** Contacto-cêntrico. A tabela `people` (rótulo UI "Contactos") ganha `types text[]`, `financial_capacity`, `source`, `last_interaction_at` e `details jsonb`. Interações ficam numa tabela nova `contact_interactions`. Filtragem avançada é feita no cliente. Leads criam/atualizam contactos. IA via Groq (Whisper para transcrição, llama-3.3-70b para extração).

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (Postgres + RLS), TypeScript, OpenAI SDK apontado à Groq. Sem framework de testes no projeto — **verificação por `npm run build`, `npx eslint` e preview no browser** (padrão existente).

**Nota de nomenclatura:** o tipo `Contact` e a tabela `contacts` já existem para *interações de lead*. Não mexer nesses. Os nossos "contactos" são a tabela `people`.

**Ref. spec:** `docs/superpowers/specs/2026-07-06-contactos-crm-design.md`

**Convenção de verificação usada em todo o plano:**
- `npm run build` → esperado: `Compiled successfully`, sem erros de tipo.
- `npx eslint app components lib` → esperado: sem erros novos.
- Preview: `preview_start` (config `dev`) e verificação visual/console conforme indicado.

---

## FASE 1 — Contactos (base, tipos, cores, filtros, capacidade, interações, notas)

### Task 1: Migração — enriquecer `people` + tabela `contact_interactions`

**Files:**
- Create: `supabase/migrations/20260706_contacts_enrichment.sql`

- [ ] **Step 1: Escrever a migração**

```sql
-- ENRIQUECER people (base central de Contactos)
alter table public.people add column if not exists types text[] not null default '{}';
alter table public.people add column if not exists financial_capacity text
  check (financial_capacity in ('muito_baixo','baixo','medio','medio_alto','alto','altissimo'));
alter table public.people add column if not exists source text;
alter table public.people add column if not exists last_interaction_at timestamptz;
alter table public.people add column if not exists details jsonb not null default '{}';

create index if not exists people_types_idx on public.people using gin (types);
create index if not exists people_last_interaction_idx on public.people(agency_id, last_interaction_at);

-- INTERAÇÕES por contacto (distinto da tabela `contacts`, que é por lead)
create table if not exists public.contact_interactions (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  person_id   uuid not null references public.people(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  type        text not null check (type in ('chamada','visita','email','whatsapp','nota')),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists contact_interactions_person_idx
  on public.contact_interactions(person_id, created_at desc);

alter table public.contact_interactions enable row level security;
create policy "contact_interactions: own agency" on public.contact_interactions
  for all using (agency_id = public.get_my_agency_id());
```

- [ ] **Step 2: Aplicar a migração**

Aplicar via MCP Supabase (`apply_migration`, name `contacts_enrichment`) ou, se em dev local, `supabase db push`. Esperado: sem erro.

- [ ] **Step 3: Verificar colunas**

Via MCP `execute_sql`: `select column_name from information_schema.columns where table_name='people';`
Esperado: contém `types`, `financial_capacity`, `source`, `last_interaction_at`, `details`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260706_contacts_enrichment.sql
git commit -m "feat(db): enriquecer people + tabela contact_interactions"
```

---

### Task 2: Constantes e helpers de Contactos

**Files:**
- Create: `lib/contacts/constants.ts`

- [ ] **Step 1: Criar o módulo de constantes/helpers**

```ts
// lib/contacts/constants.ts
export type ContactTypeKey = 'comprador' | 'vendedor' | 'investidor' | 'servico'

export const CONTACT_TYPES: { key: ContactTypeKey; label: string; plural: string; color: string }[] = [
  { key: 'comprador',  label: 'Comprador',  plural: 'Compradores',  color: '#3B82F6' }, // azul suave
  { key: 'vendedor',   label: 'Vendedor',   plural: 'Vendedores',   color: '#10B981' }, // verde suave
  { key: 'investidor', label: 'Investidor', plural: 'Investidores', color: '#8B5CF6' }, // roxo suave
  { key: 'servico',    label: 'Serviço',    plural: 'Serviços',     color: '#B07D2E' }, // âmbar
]

export function contactTypeMeta(key: string) {
  return CONTACT_TYPES.find(t => t.key === key)
}

export type CapacityBand = 'muito_baixo' | 'baixo' | 'medio' | 'medio_alto' | 'alto' | 'altissimo'

export const CAPACITY_BANDS: { key: CapacityBand; label: string; range: string; max: number }[] = [
  { key: 'muito_baixo', label: 'Muito baixo', range: '< 250k',      max: 250_000 },
  { key: 'baixo',       label: 'Baixo',       range: '250k – 500k', max: 500_000 },
  { key: 'medio',       label: 'Médio',       range: '500k – 1M',   max: 1_000_000 },
  { key: 'medio_alto',  label: 'Médio-alto',  range: '1M – 2.5M',   max: 2_500_000 },
  { key: 'alto',        label: 'Alto',        range: '2.5M – 5M',   max: 5_000_000 },
  { key: 'altissimo',   label: 'Altíssimo',   range: '5M+',         max: Infinity },
]

export function capacityMeta(key: string | null | undefined) {
  return CAPACITY_BANDS.find(b => b.key === key)
}

// Mapeia um valor de orçamento (€) para a banda de capacidade financeira.
export function budgetToCapacity(budget: number | null | undefined): CapacityBand | null {
  if (budget == null || budget <= 0) return null
  for (const b of CAPACITY_BANDS) if (budget < b.max) return b.key
  return 'altissimo'
}

export const CONTACT_SOURCES = ['idealista', 'site', 'referencia', 'audio', 'manual', 'outro'] as const
export type ContactSource = typeof CONTACT_SOURCES[number]

export const SOURCE_LABELS: Record<ContactSource, string> = {
  idealista: 'Idealista', site: 'Site', referencia: 'Referência',
  audio: 'Áudio', manual: 'Manual', outro: 'Outro',
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Esperado: `Compiled successfully` (módulo importável, sem erros de tipo).

- [ ] **Step 3: Commit**

```bash
git add lib/contacts/constants.ts
git commit -m "feat: constantes e helpers de Contactos (tipos, cores, capacidade)"
```

---

### Task 3: Atualizar o tipo `Person`

**Files:**
- Modify: `types/index.ts:55-64`
- Create: `types/contact.ts`

- [ ] **Step 1: Criar tipos de contacto/detalhes**

```ts
// types/contact.ts
import type { ContactTypeKey, CapacityBand } from '@/lib/contacts/constants'

export type ContactTemperature = 'quente' | 'morno' | 'frio'

export type ContactDetails = {
  // comprador / investidor
  looking_for?: string
  search_zone?: string
  temperature?: ContactTemperature
  already_bought?: boolean
  // vendedor
  selling_property?: string
  selling_zone?: string
  selling_price?: number
  typology?: string
  has_garage?: boolean
  has_balcony?: boolean
  has_exclusivity?: boolean
  is_active_seller?: boolean
  // serviço
  service_type?: string
}

export type ContactInteractionType = 'chamada' | 'visita' | 'email' | 'whatsapp' | 'nota'

export type ContactInteraction = {
  id: string
  agency_id: string
  person_id: string
  user_id: string | null
  type: ContactInteractionType
  note: string | null
  created_at: string
  users?: { name: string; avatar_initials: string }
}

export type { ContactTypeKey, CapacityBand }
```

- [ ] **Step 2: Estender `Person` em `types/index.ts`**

Substituir o bloco `export type Person = { ... }` (linhas ~55-64) por:

```ts
export type Person = {
  id: string
  agency_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  types: import('./contact').ContactTypeKey[]
  financial_capacity: import('./contact').CapacityBand | null
  source: string | null
  last_interaction_at: string | null
  details: import('./contact').ContactDetails
  created_at: string
}
```

E no fim de `types/index.ts`, junto às outras re-exportações, adicionar:

```ts
export type { ContactDetails, ContactTemperature, ContactInteraction, ContactInteractionType } from './contact'
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Esperado: `Compiled successfully`. (Se falhar por `details`/`types` em uso antigo, é esperado nas páginas que ainda não atualizámos — corrigidas nas Tasks seguintes; se o build parar, prosseguir para Task 4/5 antes de re-verificar.)

- [ ] **Step 4: Commit**

```bash
git add types/index.ts types/contact.ts
git commit -m "feat(types): Person com types, capacidade, source, details"
```

---

### Task 4: API — `GET/POST /api/people` aceitam novos campos

**Files:**
- Modify: `app/api/people/route.ts`

- [ ] **Step 1: Atualizar `GET` para devolver os novos campos e filtrar por tipo**

No `GET`, depois de ler `search`, ler também `types`:

```ts
const search = searchParams.get('search')
const typesParam = searchParams.get('types') // csv: "comprador,vendedor"

let query = supabase
  .from('people')
  .select('*, leads(id, name, stage_id, deal_value, pipeline_stages(name, color))')
  .order('last_interaction_at', { ascending: false, nullsFirst: false })
  .order('created_at', { ascending: false })

if (typesParam) {
  const arr = typesParam.split(',').filter(Boolean)
  if (arr.length) query = query.overlaps('types', arr)
}

if (search) {
  const term = search.replace(/[%_\\]/g, '\\$&')
  query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
}
```

- [ ] **Step 2: `POST` — whitelist de campos (evitar gravar lixo do body)**

Substituir o corpo do `POST` (a partir de `const body = await request.json()`) por:

```ts
const body = await request.json()
const insert = {
  agency_id: profile.agency_id,
  name: body.name,
  email: body.email || null,
  phone: body.phone || null,
  address: body.address || null,
  notes: body.notes || null,
  types: Array.isArray(body.types) ? body.types : [],
  financial_capacity: body.financial_capacity || null,
  source: body.source || 'manual',
  details: body.details && typeof body.details === 'object' ? body.details : {},
}

const { data, error } = await supabase.from('people').insert(insert).select().single()
if (error) return NextResponse.json({ error: error.message }, { status: 500 })
return NextResponse.json(data, { status: 201 })
```

- [ ] **Step 3: Verificar build + lint**

Run: `npm run build && npx eslint app/api/people/route.ts`
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/api/people/route.ts
git commit -m "feat(api): people GET filtra por tipo, POST aceita novos campos"
```

---

### Task 5: API — `PATCH /api/people/[id]` com whitelist

**Files:**
- Modify: `app/api/people/[id]/route.ts:23-39`

- [ ] **Step 1: Whitelist no `PATCH`**

Substituir o corpo do `PATCH` (a partir de `const body = await request.json()`) por:

```ts
const body = await request.json()
const allowed = ['name','email','phone','address','notes','types','financial_capacity','source','details'] as const
const update: Record<string, unknown> = {}
for (const k of allowed) if (k in body) update[k] = body[k]

const { data, error } = await supabase
  .from('people')
  .update(update)
  .eq('id', id)
  .select()
  .single()

if (error) return NextResponse.json({ error: error.message }, { status: 500 })
return NextResponse.json(data)
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Esperado: `Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add app/api/people/[id]/route.ts
git commit -m "feat(api): PATCH people com whitelist de campos"
```

---

### Task 6: API — interações do contacto

**Files:**
- Create: `app/api/people/[id]/interactions/route.ts`

- [ ] **Step 1: Criar rota GET (listar) + POST (criar e atualizar last_interaction_at)**

```ts
// app/api/people/[id]/interactions/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('contact_interactions')
    .select('*, users(name, avatar_initials)')
    .eq('person_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('agency_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json() as { type: string; note?: string }
  const { data, error } = await supabase
    .from('contact_interactions')
    .insert({ agency_id: profile.agency_id, person_id: id, user_id: user.id, type: body.type, note: body.note || null })
    .select('*, users(name, avatar_initials)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // denormalizar última interação no contacto
  await supabase.from('people').update({ last_interaction_at: data.created_at }).eq('id', id)

  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Verificar build + lint**

Run: `npm run build && npx eslint app/api/people/[id]/interactions/route.ts`
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/api/people/[id]/interactions/route.ts"
git commit -m "feat(api): interações por contacto + last_interaction_at"
```

---

### Task 7: Renomear "Pessoas" → "Contactos" na navegação

**Files:**
- Modify: `components/layout/Sidebar.tsx:10`
- Modify: `components/CommandPalette.tsx` (entradas que digam "Pessoas")

- [ ] **Step 1: Sidebar**

Em `Sidebar.tsx` linha 10, trocar `label: 'Pessoas'` por `label: 'Contactos'` (manter `href: '/people'`, `icon: 'people'`).

- [ ] **Step 2: Command palette**

Run: `grep -n "Pessoas" components/CommandPalette.tsx`
Para cada ocorrência que rotule a navegação para `/people`, trocar o texto visível para `Contactos` (manter href `/people`).

- [ ] **Step 3: Verificar preview**

`preview_start` (config `dev`); `preview_snapshot` da sidebar. Esperado: item "Contactos" visível, link vai para `/people`.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx components/CommandPalette.tsx
git commit -m "feat(ui): renomear Pessoas para Contactos na navegação"
```

---

### Task 8: Componente `ContactTypeChips`

**Files:**
- Create: `components/contacts/ContactTypeChips.tsx`

- [ ] **Step 1: Criar o componente de chips coloridos**

```tsx
// components/contacts/ContactTypeChips.tsx
import { contactTypeMeta } from '@/lib/contacts/constants'

export function ContactTypeChips({ types, size = 11 }: { types: string[]; size?: number }) {
  if (!types || types.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {types.map(t => {
        const meta = contactTypeMeta(t)
        if (!meta) return null
        return (
          <span key={t} style={{
            fontSize: size, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
            background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}33`,
          }}>{meta.label}</span>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Esperado: `Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add components/contacts/ContactTypeChips.tsx
git commit -m "feat(ui): componente ContactTypeChips"
```

---

### Task 9: Reescrever a lista de Contactos (`/people`) — toggles, previews por tipo, filtros

**Files:**
- Modify: `app/(app)/people/page.tsx` (reescrita)
- Create: `components/contacts/ContactFilters.tsx`
- Create: `components/contacts/NewContactModal.tsx`

Esta task substitui o formulário e a tabela atuais. A lista passa a:
1. buscar `/api/people` (todos), guardar em estado;
2. barra de toggles de tipo (multi) no topo;
3. pesquisa por nome/telefone/email (client-side sobre a lista já carregada, mantendo debounce só para futuros fetch por servidor — aqui filtramos no cliente);
4. botão "Filtros" que abre `ContactFilters` (painel de checkboxes) e devolve um predicado;
5. cartões com preview específico por tipo;
6. botão "+ Novo Contacto" abre `NewContactModal`.

- [ ] **Step 1: Criar `ContactFilters.tsx`**

```tsx
// components/contacts/ContactFilters.tsx
'use client'
import { CAPACITY_BANDS } from '@/lib/contacts/constants'
import type { Person } from '@/types'

export type ContactFilterState = {
  capacities: string[]
  temperatures: string[]
  sources: string[]
  hasGarage: boolean
  hasBalcony: boolean
  hasExclusivity: boolean
  activeSeller: boolean
  alreadyBought: boolean
}

export const EMPTY_FILTERS: ContactFilterState = {
  capacities: [], temperatures: [], sources: [],
  hasGarage: false, hasBalcony: false, hasExclusivity: false,
  activeSeller: false, alreadyBought: false,
}

export function applyContactFilters(people: Person[], f: ContactFilterState): Person[] {
  return people.filter(p => {
    if (f.capacities.length && !f.capacities.includes(p.financial_capacity ?? '')) return false
    if (f.temperatures.length && !f.temperatures.includes(p.details?.temperature ?? '')) return false
    if (f.sources.length && !f.sources.includes(p.source ?? '')) return false
    if (f.hasGarage && !p.details?.has_garage) return false
    if (f.hasBalcony && !p.details?.has_balcony) return false
    if (f.hasExclusivity && !p.details?.has_exclusivity) return false
    if (f.activeSeller && !p.details?.is_active_seller) return false
    if (f.alreadyBought && !p.details?.already_bought) return false
    return true
  })
}

export function ContactFilters({ value, onChange, onClose }: {
  value: ContactFilterState
  onChange: (f: ContactFilterState) => void
  onClose: () => void
}) {
  const toggleArr = (key: 'capacities' | 'temperatures' | 'sources', v: string) => {
    const arr = value[key].includes(v) ? value[key].filter(x => x !== v) : [...value[key], v]
    onChange({ ...value, [key]: arr })
  }
  const toggleBool = (key: keyof ContactFilterState) => onChange({ ...value, [key]: !value[key] })
  const cb = (checked: boolean) => ({ width: 15, height: 15, accentColor: '#B07D2E', cursor: 'pointer' as const })

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Capacidade financeira</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {CAPACITY_BANDS.map(b => (
            <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={cb(false)} checked={value.capacities.includes(b.key)} onChange={() => toggleArr('capacities', b.key)} />
              {b.label} <span style={{ color: 'var(--muted)' }}>({b.range})</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Temperatura</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {['quente','morno','frio'].map(t => (
            <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>
              <input type="checkbox" style={cb(false)} checked={value.temperatures.includes(t)} onChange={() => toggleArr('temperatures', t)} />
              {t}
            </label>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Imóvel / negócio</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {[
            ['hasGarage','Tem garagem'], ['hasBalcony','Tem varanda'],
            ['hasExclusivity','Exclusividade'], ['activeSeller','Vendedor ativo'],
            ['alreadyBought','Já comprou'],
          ].map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={cb(false)} checked={value[key as keyof ContactFilterState] as boolean} onChange={() => toggleBool(key as keyof ContactFilterState)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={() => onChange(EMPTY_FILTERS)} style={{ fontSize: 12 }}>Limpar</button>
        <button className="btn btn-primary" onClick={onClose} style={{ fontSize: 12 }}>Aplicar</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `NewContactModal.tsx`**

Modal com: nome*, email, telefone, seletor multi de tipos (chips clicáveis usando `CONTACT_TYPES`), seletor de capacidade (`CAPACITY_BANDS`), origem (`CONTACT_SOURCES`), e campos condicionais em `details` conforme os tipos escolhidos (comprador: `looking_for`, `search_zone`, `temperature`, `already_bought`; vendedor: `selling_property`, `selling_zone`, `selling_price`, `typology`, `has_garage`, `has_balcony`, `has_exclusivity`, `is_active_seller`; serviço: `service_type`). Submete `POST /api/people` com `{ name, email, phone, types, financial_capacity, source, details }`. Estrutura base:

```tsx
// components/contacts/NewContactModal.tsx
'use client'
import { useState } from 'react'
import { CONTACT_TYPES, CAPACITY_BANDS, CONTACT_SOURCES, SOURCE_LABELS, type ContactTypeKey } from '@/lib/contacts/constants'
import type { ContactDetails } from '@/types'

type Props = { initial?: Partial<{ name: string; email: string; phone: string; types: ContactTypeKey[]; financial_capacity: string; source: string; details: ContactDetails }>; onClose: () => void; onCreated: () => void }

export function NewContactModal({ initial, onClose, onCreated }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [types, setTypes] = useState<ContactTypeKey[]>(initial?.types ?? [])
  const [capacity, setCapacity] = useState(initial?.financial_capacity ?? '')
  const [source, setSource] = useState(initial?.source ?? 'manual')
  const [details, setDetails] = useState<ContactDetails>(initial?.details ?? {})
  const [saving, setSaving] = useState(false)

  const toggleType = (t: ContactTypeKey) => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])
  const d = (k: keyof ContactDetails, v: unknown) => setDetails(p => ({ ...p, [k]: v }))
  const has = (t: ContactTypeKey) => types.includes(t)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/people', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, types, financial_capacity: capacity || null, source, details }),
      })
      if (res.ok) { onCreated(); onClose() }
    } finally { setSaving(false) }
  }

  // ... render: inputs base + chips de tipo + select capacidade + select origem +
  //     secções condicionais (has('comprador') || has('investidor')) e has('vendedor') e has('servico')
  //     seguindo o estilo modal/input existente em app/(app)/people/page.tsx.
  return null // substituir por JSX conforme descrito acima
}
```

> **Nota ao executor:** o `return null` é um esqueleto. Implementar o JSX seguindo exatamente as classes `modal-backdrop`/`modal`/`input`/`btn` já usadas em `app/(app)/people/page.tsx` (linhas 48-66) e os campos condicionais listados. Campos numéricos (`selling_price`) convertidos com `Number(...) || undefined`.

- [ ] **Step 3: Reescrever `app/(app)/people/page.tsx`**

Nova página cliente que:
- fetch `/api/people` uma vez → `people`;
- estado: `search`, `activeTypes: ContactTypeKey[]`, `filters: ContactFilterState`, `showFilters`, `showNew`;
- barra de toggles: botão por `CONTACT_TYPES` (mais "Todos"); ativo = fundo `color+18`, texto `color`;
- lista visível = `applyContactFilters(people, filters)` → filtrar por `activeTypes` (overlap) → filtrar por `search` (nome/phone/email);
- cada item é um cartão com `ContactTypeChips` + preview por tipo:
  - vendedor: `details.selling_property` · `details.selling_zone` · `€ details.selling_price` · "Último contacto: {relativo}" + badge de aviso se `last_interaction_at` < hoje-10d e `details.is_active_seller`;
  - comprador/investidor: `details.looking_for` · `details.search_zone` · `capacityMeta(financial_capacity)?.label` · temperatura;
  - serviço: `details.service_type` · email/telefone;
- clique no cartão → `router.push('/people/' + id)`;
- header com "+ Novo Contacto" → `showNew`.

Helper de "último contacto" (adicionar no ficheiro):

```tsx
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
```

Regra do badge de vendedor inativo (no cartão):

```tsx
const stale = person.types.includes('vendedor') && person.details?.is_active_seller
  && (daysSince(person.last_interaction_at) == null || (daysSince(person.last_interaction_at) ?? 0) > 10)
// se stale: mostrar badge "⚠ Sem contacto há +10 dias" (cor #EF4444, fundo rgba(239,68,68,0.1))
```

- [ ] **Step 4: Verificar preview**

`preview_start` config `dev`; navegar a `/people`; `preview_snapshot`. Esperado: toggles de tipo, pesquisa, botão Filtros, cartões com chips coloridos. `preview_console_logs level error` → sem erros.

- [ ] **Step 5: Verificar build + lint**

Run: `npm run build && npx eslint app components`
Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/people/page.tsx" components/contacts/ContactFilters.tsx components/contacts/NewContactModal.tsx
git commit -m "feat(contactos): lista com toggles de tipo, filtros avançados e novo contacto"
```

---

### Task 10: Ficha do contacto — secções por tipo, interações, notas

**Files:**
- Modify: `app/(app)/people/[id]/page.tsx` (reescrita do painel de edição/visualização)
- Create: `components/contacts/InteractionTimeline.tsx`

- [ ] **Step 1: Criar `InteractionTimeline.tsx`**

```tsx
// components/contacts/InteractionTimeline.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import type { ContactInteraction } from '@/types'

const TYPES = [['chamada','Chamada'],['visita','Visita'],['email','Email'],['whatsapp','WhatsApp'],['nota','Nota']] as const

export function InteractionTimeline({ personId, onLogged }: { personId: string; onLogged?: () => void }) {
  const [items, setItems] = useState<ContactInteraction[]>([])
  const [type, setType] = useState('chamada')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/people/${personId}/interactions`)
    if (res.ok) setItems(await res.json())
  }, [personId])
  useEffect(() => { load() }, [load])

  async function add() {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/people/${personId}/interactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, note }),
      })
      if (res.ok) { setNote(''); await load(); onLogged?.() }
    } finally { setSaving(false) }
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div className="font-display" style={{ fontSize: 15, marginBottom: 14 }}>Interações</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <select className="input" value={type} onChange={e => setType(e.target.value)} style={{ width: 130 }}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className="input" placeholder="Nota..." value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={add} disabled={saving}>Registar</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sem interações registadas.</div>}
        {items.map(it => (
          <div key={it.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{it.type}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(it.created_at).toLocaleDateString('pt-PT')}</span>
            </div>
            {it.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{it.note}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Estender a ficha `app/(app)/people/[id]/page.tsx`**

No estado `form`, incluir `types`, `financial_capacity`, `source`, e um objeto `details`. Ao carregar (`fetchPerson`), preencher a partir de `data`. No `save()`, enviar também `types`, `financial_capacity`, `source`, `details`.

Adicionar na coluna esquerda, por baixo da info comum:
- `ContactTypeChips` no cabeçalho (a seguir ao nome);
- editor de tipos (chips clicáveis) e capacidade quando `editing`;
- **secção condicional por tipo** (mesmos campos do `NewContactModal`), mostrada como leitura quando não `editing` e como inputs quando `editing`;
- a secção "Notas" já existente mantém-se **no fim** da coluna.

Na coluna direita, por cima de "Negócios", inserir `<InteractionTimeline personId={id} onLogged={fetchPerson} />`.

> **Nota ao executor:** reutilizar `inputStyle` já definido no ficheiro (linha ~60) para os novos inputs. Para os campos de `details`, usar handlers `setForm(p => ({ ...p, details: { ...p.details, [k]: v } }))`.

- [ ] **Step 3: Verificar preview**

`/people/{um-id}`: ver chips, secção do tipo, timeline com "Registar", e Notas no fim. Registar uma interação → aparece na lista e "último contacto" atualiza. `preview_console_logs level error` → sem erros.

- [ ] **Step 4: Verificar build + lint**

Run: `npm run build && npx eslint app components`
Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/people/[id]/page.tsx" components/contacts/InteractionTimeline.tsx
git commit -m "feat(contactos): ficha com secções por tipo, interações e notas"
```

---

### Task 11: Cron — notificação de vendedor inativo (+10 dias)

**Files:**
- Create: `app/api/cron/seller-inactive/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Criar o cron**

```ts
// app/api/cron/seller-inactive/route.ts
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'

const INACTIVE_DAYS = 10

export async function GET(request: Request) { return handle(request) }
export async function POST(request: Request) { return handle(request) }

async function handle(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS)

  // vendedores ativos
  const { data: sellers } = await supabase
    .from('people')
    .select('id, agency_id, name, last_interaction_at, created_at, details')
    .contains('types', ['vendedor'])
    .contains('details', { is_active_seller: true })

  if (!sellers || sellers.length === 0) return NextResponse.json({ processed: 0 })

  // um admin por agência para receber a notificação
  const agencyIds = [...new Set(sellers.map(s => s.agency_id))]
  const { data: admins } = await supabase
    .from('users').select('id, agency_id').eq('role', 'admin').in('agency_id', agencyIds)
  const adminByAgency = new Map<string, string>()
  for (const a of admins ?? []) if (!adminByAgency.has(a.agency_id)) adminByAgency.set(a.agency_id, a.id)

  let processed = 0
  for (const s of sellers) {
    const ref = s.last_interaction_at ? new Date(s.last_interaction_at) : new Date(s.created_at)
    if (ref > cutoff) continue
    const userId = adminByAgency.get(s.agency_id)
    if (!userId) continue
    await createNotification({
      userId, agencyId: s.agency_id, type: 'task_due',
      title: `Vendedor sem contacto: ${s.name}`,
      body: `Já não falas com ${s.name} há mais de ${INACTIVE_DAYS} dias.`,
      link: `/people/${s.id}`,
    }, supabase)
    processed++
  }
  return NextResponse.json({ processed })
}
```

> **Nota:** reutiliza o tipo de notificação `task_due` (já existe em `NotificationType`) para não alterar o enum/DB. Se preferires um tipo próprio, adiciona `'seller_inactive'` a `NotificationType` em `lib/notifications.ts` e ao check da tabela `notifications`.

- [ ] **Step 2: Registar no `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/task-reminders", "schedule": "0 8 * * *" },
    { "path": "/api/cron/seller-inactive", "schedule": "0 9 * * *" }
  ]
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Esperado: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/seller-inactive/route.ts vercel.json
git commit -m "feat(cron): notificação de vendedor ativo inativo há +10 dias"
```

---

## FASE 2 — Leads → Contactos (com origem)

### Task 12: Helper — garantir contacto a partir de uma lead

**Files:**
- Create: `lib/contacts/from-lead.ts`

- [ ] **Step 1: Criar o helper**

```ts
// lib/contacts/from-lead.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { budgetToCapacity } from '@/lib/contacts/constants'

type LeadLike = {
  id: string; agency_id: string; name: string; email?: string | null; phone?: string | null
  source?: string | null; budget?: number | null; zone?: string | null; typology?: string | null
  notes?: string | null; person_id?: string | null
}

// Cria (ou atualiza) o contacto ligado a uma lead. Idealista => comprador.
// Devolve o person_id.
export async function ensureContactForLead(lead: LeadLike, supabase: SupabaseClient): Promise<string | null> {
  const source = (lead.source ?? 'outro')
  const details = {
    looking_for: lead.typology || lead.notes || undefined,
    search_zone: lead.zone || undefined,
  }
  const capacity = budgetToCapacity(lead.budget)

  if (lead.person_id) {
    // enriquecer sem sobrepor dados existentes: só preencher o que estiver vazio
    const { data: existing } = await supabase.from('people').select('types, financial_capacity, details, source').eq('id', lead.person_id).single()
    if (existing) {
      const types = new Set<string>([...(existing.types ?? []), 'comprador'])
      await supabase.from('people').update({
        types: [...types],
        financial_capacity: existing.financial_capacity ?? capacity,
        source: existing.source ?? source,
        details: { ...details, ...(existing.details ?? {}) },
      }).eq('id', lead.person_id)
    }
    return lead.person_id
  }

  const { data: created, error } = await supabase.from('people').insert({
    agency_id: lead.agency_id,
    name: lead.name, email: lead.email || null, phone: lead.phone || null,
    types: ['comprador'], financial_capacity: capacity, source,
    details,
  }).select('id').single()
  if (error) return null
  return created.id
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Esperado: `Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add lib/contacts/from-lead.ts
git commit -m "feat: helper ensureContactForLead (Idealista => comprador)"
```

---

### Task 13: Ligar criação de lead ao contacto

**Files:**
- Modify: `app/api/leads/route.ts` (POST)
- Modify: `app/api/f/[formId]/route.ts` (webform, ~linha 92)

- [ ] **Step 1: `app/api/leads/route.ts` — ligar contacto após criar a lead**

Depois de criar a lead com sucesso (após `if (error) ...` da inserção, antes de `createNotification`), inserir:

```ts
import { ensureContactForLead } from '@/lib/contacts/from-lead' // topo do ficheiro

// ... após inserir a lead:
if (!data.person_id) {
  const personId = await ensureContactForLead(data, supabase)
  if (personId) {
    await supabase.from('leads').update({ person_id: personId }).eq('id', data.id)
    data.person_id = personId
  }
} else {
  await ensureContactForLead(data, supabase)
}
```

- [ ] **Step 2: `app/api/f/[formId]/route.ts` — idem para leads de formulário**

Localizar onde a lead é inserida (perto de `source: 'site'`, ~linha 92). Depois da inserção bem-sucedida, chamar `ensureContactForLead(insertedLead, supabase)` e atualizar `person_id` na lead (mesmo padrão do Step 1). Importar o helper no topo.

Run primeiro: `grep -n "insert\|source\|person_id" app/api/f/[formId]/route.ts` para localizar a inserção exata.

- [ ] **Step 3: Verificar build + lint**

Run: `npm run build && npx eslint app/api/leads/route.ts "app/api/f/[formId]/route.ts"`
Esperado: sem erros.

- [ ] **Step 4: Verificar comportamento no preview**

Criar uma lead nova (via UI de leads) e confirmar que aparece um contacto novo em `/people` com origem preenchida e tipo "Comprador". `preview_console_logs level error` → sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/api/leads/route.ts "app/api/f/[formId]/route.ts"
git commit -m "feat(leads): toda a lead cria/atualiza contacto com origem"
```

---

## FASE 3 — Imóveis (vendedor, visitas, email de fecho)

### Task 14: Migração — tabela `property_visits`

**Files:**
- Create: `supabase/migrations/20260706_property_visits.sql`

- [ ] **Step 1: Escrever a migração**

```sql
create table if not exists public.property_visits (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  person_id    uuid references public.people(id) on delete set null,
  visitor_name text,
  agency_name  text,
  visited_at   timestamptz not null default now(),
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists property_visits_property_idx on public.property_visits(property_id, visited_at desc);

alter table public.property_visits enable row level security;
create policy "property_visits: own agency" on public.property_visits
  for all using (agency_id = public.get_my_agency_id());
```

- [ ] **Step 2: Aplicar migração** (MCP `apply_migration` name `property_visits`). Esperado: sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260706_property_visits.sql
git commit -m "feat(db): tabela property_visits"
```

---

### Task 15: API — visitas de imóvel

**Files:**
- Create: `app/api/properties/[id]/visits/route.ts`

- [ ] **Step 1: Criar GET (listar) + POST (criar)**

```ts
// app/api/properties/[id]/visits/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('property_visits')
    .select('*, people(id, name)')
    .eq('property_id', id)
    .order('visited_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('users').select('agency_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json() as { person_id?: string; visitor_name?: string; agency_name?: string; visited_at?: string; notes?: string }
  const { data, error } = await supabase.from('property_visits').insert({
    agency_id: profile.agency_id, property_id: id,
    person_id: body.person_id || null, visitor_name: body.visitor_name || null,
    agency_name: body.agency_name || null, visited_at: body.visited_at || new Date().toISOString(),
    notes: body.notes || null,
  }).select('*, people(id, name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Verificar build + lint**

Run: `npm run build && npx eslint "app/api/properties/[id]/visits/route.ts"`
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/api/properties/[id]/visits/route.ts"
git commit -m "feat(api): visitas de imóvel"
```

---

### Task 16: UI do imóvel — vendedor + visitas

**Files:**
- Modify: `app/(app)/properties/[id]/page.tsx`

- [ ] **Step 1: Mostrar contacto vendedor**

Run: `grep -n "person_id\|people\|GET\|select" app/api/properties/[id]/route.ts` para confirmar se a API já devolve `people`. Se não, alterar o `select` em `app/api/properties/[id]/route.ts` para incluir `people(id, name, phone, email)`.

Na ficha, adicionar um cartão "Vendedor" que, se `property.person_id`, mostra nome (link para `/people/{id}`) + telefone/email.

- [ ] **Step 2: Secção de visitas**

Adicionar cartão "Visitas": lista via `GET /api/properties/{id}/visits` + formulário para registar visita (campos: contacto existente OU nome/agência, data, notas). Cada visita mostra o nome (link se `people` presente) e data. Seguir o estilo dos cartões existentes na página.

- [ ] **Step 3: Verificar preview + build**

`/properties/{id}`: cartão Vendedor e Visitas visíveis; registar visita funciona. Run: `npm run build`. Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/properties/[id]/page.tsx" "app/api/properties/[id]/route.ts"
git commit -m "feat(imoveis): cartão de vendedor e registo de visitas"
```

---

### Task 17: Email de fecho (parabéns + Google review) via IA

**Files:**
- Create: `app/api/ai/closing-email/route.ts`
- Modify: `lib/ai/prompts.ts` (novo builder)
- Modify: `app/(app)/properties/[id]/page.tsx` (ação "Gerar email de fecho" quando status=vendido)

- [ ] **Step 1: Prompt builder em `lib/ai/prompts.ts`**

Adicionar (no fim do ficheiro):

```ts
export function buildClosingEmailPrompt(params: {
  propertyTitle: string
  contactNames: string[]
  agentName: string
  agencyName: string
  reviewLink: string
}): string {
  const { propertyTitle, contactNames, agentName, agencyName, reviewLink } = params
  return [
    `Escreve um email caloroso e profissional em português de Portugal.`,
    `Contexto: acabámos de fechar a venda do imóvel "${propertyTitle}".`,
    `Destinatários envolvidos no negócio: ${contactNames.join(', ')}.`,
    `Objetivos do email:`,
    `1) Agradecer e parabenizar todos os envolvidos pelo negócio concluído.`,
    `2) Pedir gentilmente uma avaliação (Google review) com este link: ${reviewLink}`,
    `Assina como ${agentName}, da agência ${agencyName}.`,
    `Devolve APENAS o corpo do email (sem assunto, sem markdown).`,
  ].join('\n')
}
```

- [ ] **Step 2: Rota `app/api/ai/closing-email/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import { buildClosingEmailPrompt } from '@/lib/ai/prompts'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { property_id } = await request.json() as { property_id: string }
  if (!property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 })

  const [{ data: profile }, { data: property }, { data: agency }] = await Promise.all([
    supabase.from('users').select('name').eq('id', user.id).single(),
    supabase.from('properties').select('title, person_id, people(name)').eq('id', property_id).single(),
    supabase.from('agencies').select('name').single(),
  ])
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // contactos envolvidos: vendedor + compradores das leads ligadas ao imóvel + visitas ligadas
  const [{ data: leads }, { data: visits }] = await Promise.all([
    supabase.from('leads').select('people(name)').eq('property_id', property_id),
    supabase.from('property_visits').select('people(name)').eq('property_id', property_id),
  ])
  const names = new Set<string>()
  const sellerName = (property as { people?: { name?: string } }).people?.name
  if (sellerName) names.add(sellerName)
  for (const l of leads ?? []) { const n = (l as { people?: { name?: string } }).people?.name; if (n) names.add(n) }
  for (const v of visits ?? []) { const n = (v as { people?: { name?: string } }).people?.name; if (n) names.add(n) }

  const prompt = buildClosingEmailPrompt({
    propertyTitle: property.title,
    contactNames: [...names].length ? [...names] : ['Cliente'],
    agentName: profile?.name ?? 'Agente',
    agencyName: agency?.name ?? 'Agência',
    reviewLink: process.env.GOOGLE_REVIEW_LINK ?? 'https://g.page/r/CONFIGURAR-REVIEW',
  })

  const completion = await getAIClient().chat.completions.create({
    model: AI_MODEL, max_tokens: 512, temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
  })
  return NextResponse.json({ body: completion.choices[0]?.message?.content?.trim() ?? '', recipients: [...names] })
}
```

- [ ] **Step 3: Ação na ficha do imóvel**

Quando `property.status === 'vendido'`, mostrar botão "Gerar email de fecho" que faz `POST /api/ai/closing-email` e abre o `SendEmailModal` existente (`components/leads/SendEmailModal.tsx`) com o corpo devolvido pré-preenchido. Verificar as props do modal:

Run: `sed -n '1,40p' components/leads/SendEmailModal.tsx`
Adaptar a chamada às props reais (assunto sugerido: `Parabéns pelo negócio — {property.title}`).

- [ ] **Step 4: Verificar build + preview**

Run: `npm run build`. No preview, num imóvel "vendido", clicar "Gerar email de fecho" → texto gerado abre no modal. (Requer `GROQ_API_KEY` no ambiente.)

- [ ] **Step 5: Commit**

```bash
git add app/api/ai/closing-email/route.ts lib/ai/prompts.ts "app/(app)/properties/[id]/page.tsx"
git commit -m "feat(imoveis): email de fecho (parabéns + Google review) via IA"
```

---

## FASE 4 — Criar contacto por áudio

### Task 18: API — transcrição + extração de contacto

**Files:**
- Create: `app/api/ai/transcribe-contact/route.ts`
- Modify: `lib/ai/prompts.ts` (builder de extração)

- [ ] **Step 1: Prompt de extração em `lib/ai/prompts.ts`**

```ts
export function buildContactExtractionPrompt(transcript: string): string {
  return [
    `Extrai dados de contacto imobiliário a partir desta transcrição (português).`,
    `Transcrição: """${transcript}"""`,
    `Devolve APENAS JSON válido com este formato (sem texto extra):`,
    `{"name": string, "phone": string|null, "email": string|null,`,
    ` "types": array de ("comprador"|"vendedor"|"investidor"|"servico"),`,
    ` "financial_capacity": ("muito_baixo"|"baixo"|"medio"|"medio_alto"|"alto"|"altissimo")|null,`,
    ` "details": {"looking_for"?: string, "search_zone"?: string, "temperature"?: ("quente"|"morno"|"frio"),`,
    `  "selling_property"?: string, "selling_zone"?: string, "selling_price"?: number, "typology"?: string,`,
    `  "has_garage"?: boolean, "has_balcony"?: boolean, "has_exclusivity"?: boolean, "is_active_seller"?: boolean,`,
    `  "service_type"?: string}}`,
    `Se um campo não for mencionado, omite-o (ou usa null para name/phone/email). Bandas: <250k muito_baixo; 250-500k baixo; 500k-1M medio; 1-2.5M medio_alto; 2.5-5M alto; 5M+ altissimo.`,
  ].join('\n')
}
```

- [ ] **Step 2: Rota `app/api/ai/transcribe-contact/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAIClient, AI_MODEL } from '@/lib/ai/client'
import { buildContactExtractionPrompt } from '@/lib/ai/prompts'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('audio')
  if (!(file instanceof File)) return NextResponse.json({ error: 'audio required' }, { status: 400 })

  const client = getAIClient()
  // 1) transcrição (Groq Whisper)
  const transcription = await client.audio.transcriptions.create({
    file, model: 'whisper-large-v3',
  })
  const transcript = (transcription as { text: string }).text ?? ''

  // 2) extração de campos
  const completion = await client.chat.completions.create({
    model: AI_MODEL, max_tokens: 512, temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildContactExtractionPrompt(transcript) }],
  })
  const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
  let fields: unknown = {}
  try { fields = JSON.parse(raw) } catch { fields = {} }

  return NextResponse.json({ transcript, fields })
}
```

> **Nota:** o Groq expõe `whisper-large-v3` no endpoint compatível com OpenAI, por isso o SDK `openai` já configurado (`lib/ai/client.ts`) funciona sem mudanças.

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Esperado: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add app/api/ai/transcribe-contact/route.ts lib/ai/prompts.ts
git commit -m "feat(ai): transcrição de áudio + extração de contacto (Groq Whisper)"
```

---

### Task 19: UI — gravação de áudio no criar contacto

**Files:**
- Create: `components/contacts/AudioContactRecorder.tsx`
- Modify: `components/contacts/NewContactModal.tsx` (aba/modo Áudio)

- [ ] **Step 1: Criar `AudioContactRecorder.tsx`**

```tsx
// components/contacts/AudioContactRecorder.tsx
'use client'
import { useState, useRef } from 'react'

export function AudioContactRecorder({ onExtracted }: { onExtracted: (fields: Record<string, unknown>) => void }) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); void upload() }
      mediaRef.current = mr
      mr.start()
      setRecording(true)
    } catch { setError('Sem acesso ao microfone.') }
  }

  function stop() { mediaRef.current?.stop(); setRecording(false) }

  async function upload() {
    setProcessing(true)
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const fd = new FormData()
      fd.append('audio', new File([blob], 'contacto.webm', { type: 'audio/webm' }))
      const res = await fetch('/api/ai/transcribe-contact', { method: 'POST', body: fd })
      if (!res.ok) { setError('Falha na transcrição.'); return }
      const data = await res.json()
      onExtracted({ ...(data.fields ?? {}), source: 'audio' })
    } catch { setError('Erro ao processar o áudio.') }
    finally { setProcessing(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: 20 }}>
      <button type="button" onClick={recording ? stop : start} disabled={processing}
        className={recording ? 'btn' : 'btn btn-primary'}
        style={recording ? { background: '#EF4444', color: '#fff' } : undefined}>
        {processing ? 'A processar...' : recording ? '⏹ Parar' : '🎙 Gravar'}
      </button>
      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
        {processing ? 'A transcrever e a extrair dados...' : 'Descreve o contacto em voz alta e confirma os dados a seguir.'}
      </div>
      {error && <div style={{ fontSize: 12, color: '#EF4444' }}>{error}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Integrar no `NewContactModal`**

Adicionar um seletor de modo no topo do modal: **Manual** | **Áudio**. No modo Áudio, renderizar `<AudioContactRecorder onExtracted={fields => { /* preencher estados name/phone/email/types/capacity/details a partir de fields e mudar para modo Manual para confirmar */ }} />`. Ao extrair, mapear os campos para os estados do formulário e comutar para "Manual" para o utilizador rever e submeter (fluxo "transcreve e confirmas").

Handler de preenchimento (adicionar no componente):

```tsx
function applyExtracted(f: Record<string, unknown>) {
  if (typeof f.name === 'string') setName(f.name)
  if (typeof f.phone === 'string') setPhone(f.phone)
  if (typeof f.email === 'string') setEmail(f.email)
  if (Array.isArray(f.types)) setTypes(f.types as ContactTypeKey[])
  if (typeof f.financial_capacity === 'string') setCapacity(f.financial_capacity)
  setSource('audio')
  if (f.details && typeof f.details === 'object') setDetails(f.details as ContactDetails)
  setMode('manual')
}
```

(adicionar estado `const [mode, setMode] = useState<'manual'|'audio'>('manual')`.)

- [ ] **Step 3: Verificar build + preview**

Run: `npm run build`. No preview, abrir "+ Novo Contacto" → aba Áudio → o botão Gravar aparece. (A gravação real precisa de permissão de microfone no browser; validar pelo menos o render e ausência de erros de consola.)

- [ ] **Step 4: Commit**

```bash
git add components/contacts/AudioContactRecorder.tsx components/contacts/NewContactModal.tsx
git commit -m "feat(contactos): criar contacto por áudio (gravar → transcrever → confirmar)"
```

---

## Self-review / cobertura da spec

- Renomear Pessoas→Contactos: Task 7. ✅
- Separação por tipo + tag + toggle check: Tasks 1,2,8,9. ✅
- Cores por tipo: Task 2 (constantes) + 8 (chips). ✅
- Preview comprador (o que procura/nome/zona/capacidade) + detalhe (quente/frio, já comprou): Tasks 9,10. ✅
- Preview vendedor (o que tem/onde vende/preço/nome/último contacto) + detalhe (tipologia/varanda/garagem/exclusividade) + notificação inativo >10d: Tasks 9,10,11. ✅
- Investidor + bandas de capacidade (partilhadas com comprador): Task 2,9,10. ✅
- Barra de pesquisa + muitas checkboxes de filtro: Task 9 (`ContactFilters`). ✅
- Notas no fim da ficha: Task 10. ✅
- Leads→Contactos + origem + Idealista=comprador + preenchimento automático: Tasks 12,13. ✅
- Imóveis: vendedor + visitas (liga a contacto ou nome/agência): Tasks 14,15,16. ✅
- Email de venda (parabéns + Google review, configurável depois): Task 17. ✅
- Áudio → Groq → cria contacto (confirmar): Tasks 18,19. ✅

**Variáveis de ambiente necessárias:** `GROQ_API_KEY` (já usada), opcional `GOOGLE_REVIEW_LINK` (Task 17), `CRON_SECRET` (já usada).

**Notas de execução:** aplicar migrações antes das tasks de UI que dependem delas (Task 1 antes de 4-11; Task 14 antes de 15-16). Verificação por `npm run build` + `npx eslint` + preview no browser (o projeto não tem framework de testes).
