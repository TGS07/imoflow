# Pipeline cards — associação de imóvel e layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que um card de pipeline criado para um contacto já existente fica ligado ao imóvel certo (resolvendo automaticamente quando há só um candidato, perguntando ao consultor quando há vários), permitir trocar o imóvel de um card já criado através de um novo ícone no card, e aumentar/adaptar o layout do card para o texto configurável (nome, zona, imóvel, tipologia, valor) não cortar.

**Architecture:** Zero migrações — todos os dados necessários (properties_as_seller/buyer, property_consultants) já existem no esquema e já são devolvidos por `GET /api/people/[id]`. Uma função utilitária partilhada (`lib/pipeline/resolve-contact-property.ts`) resolve os imóveis candidatos de uma pessoa e é usada pelas duas rotas que hoje criam cards para contactos existentes sem nunca ligar um imóvel (`POST /api/people/[id]/pipeline` e `POST /api/pipelines/[id]/add-contacts`). Quando há ambiguidade (2+ candidatos), o cliente pergunta antes de submeter, passando um `property_id`/`property_choices` explícito que a rota usa em vez de resolver sozinha. Um novo ícone 🏠 no `LeadCard` abre um modal de pesquisa (mesmo padrão do `PropertyBuyer.tsx`) que faz `PATCH /api/leads/[id]` — endpoint que já aceita qualquer campo da lead, sem alterações no backend.

**Tech Stack:** Next.js 16 (rotas com `params: Promise<...>`), React 19, Supabase (Postgres + RLS). **Sem framework de testes** — verificação é `npx tsc --noEmit` + `npm run build` + preview manual no browser.

**Spec:** `docs/superpowers/specs/2026-07-26-pipeline-cards-imovel-design.md`

---

## Mapa de ficheiros

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `lib/pipeline/resolve-contact-property.ts` | Criar | Resolve os imóveis candidatos (vendedor/comprador/consultor) de uma pessoa |
| `app/api/people/[id]/pipeline/route.ts` | Modificar | POST passa a ligar `property_id` (auto ou `property_id` explícito no body) |
| `app/api/pipelines/[id]/add-contacts/route.ts` | Modificar | POST passa a ligar `property_id` em lote (auto ou `property_choices` no body) |
| `components/contacts/ContactDetailPanel.tsx` | Modificar | Pergunta qual imóvel usar no popup "+ Pipeline" quando há 2+ candidatos |
| `components/pipeline/ContactPickerModal.tsx` | Modificar | Passo extra "Qual imóvel?" no "+ Contactos" para contactos com 2+ candidatos |
| `components/pipeline/CardPropertyModal.tsx` | Criar | Modal de pesquisa para escolher/trocar o imóvel de um card |
| `components/pipeline/KanbanBoard.tsx` | Modificar | Ícone 🏠 no card, layout (coluna mais larga, texto em 2 linhas) |
| `components/pipeline/PipelineBoard.tsx` | Modificar | Passa `onCardUpdated` ao `KanbanBoard` |

## Factos do código (verificados — não re-descobrir)

- `GET /api/people/[id]` (`app/api/people/[id]/route.ts:10-15`) já devolve `properties_as_seller:properties!seller_id(...)`, `properties_as_buyer:properties!buyer_id(...)` e `property_consultants(properties(...))` — são os três joins que a nova função utilitária espelha diretamente na tabela `people`.
- `components/contacts/ContactDetailPanel.tsx` já tem um tipo local `PropertyRef = { id: string; title: string; status: string; price: number | null; reference: string | null }` (linha 29) e `PersonDetail` com os três campos acima (linhas 31-36) — reutilizável tal como está, sem precisar de novo tipo.
- `PATCH /api/leads/[id]` (`app/api/leads/[id]/route.ts`) faz `update(leadData)` com o corpo do pedido tal como vem — já aceita `property_id`, `zone`, `typology`, `budget` sem qualquer alteração no backend.
- `GET /api/properties?search=` (usado por `PropertyPickerModal.tsx:35`) já pesquisa por referência/título/morada e devolve `Property[]` com `zone`, `typology`, `price` — reutilizado tal como está no novo `CardPropertyModal`.
- `app/api/pipelines/[id]/add-properties/route.ts:74-93` é o padrão exato de como copiar `zone`/`typology`/`price` de um imóvel para os campos da lead (`zone: property.zone, typology: property.typology, budget: property.price`).
- `.icon-btn` (`app/globals.css:558-571`, 30×30px, mas usado a 20×20 no botão de duplicar) e `.modal`/`.modal-backdrop` já existem e são reutilizados sem CSS novo.
- `components/pipeline/KanbanBoard.tsx` já tem `duplicateCard(e)` com `e.stopPropagation()` no `LeadCard` (linha 43-71) — o mesmo padrão é seguido para o novo ícone 🏠, para não disparar o `onClick` do card (que abre o contacto/lead).
- `PipelineBoard.tsx:161` já passa `onDuplicated={() => selectedId && loadBoard(selectedId)}` ao `KanbanBoard` — o mesmo padrão (`onCardUpdated`) é usado para recarregar o board depois de trocar o imóvel de um card.
- `React.CSSProperties` aceita `WebkitLineClamp`/`WebkitBoxOrient` (propriedades vendor-prefixed tipadas) — usadas para o corte em 2 linhas sem `whiteSpace: 'nowrap'`.

---

### Task 1: Função utilitária — imóveis candidatos de um contacto

**Files:**
- Create: `lib/pipeline/resolve-contact-property.ts`

- [ ] **Step 1: Escrever a função**

Conteúdo completo de `lib/pipeline/resolve-contact-property.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type ContactPropertyCandidate = {
  id: string
  reference: string | null
  title: string
  zone: string | null
  typology: string | null
  price: number | null
}

// Imóveis já associados a uma pessoa como vendedora, compradora candidata ou
// consultora — candidatos a ligar ao criar um card de pipeline para ela.
// Espelha os mesmos três joins já usados em GET /api/people/[id].
export async function resolveContactPropertyCandidates(
  supabase: SupabaseClient,
  agencyId: string,
  personId: string
): Promise<ContactPropertyCandidate[]> {
  const { data } = await supabase
    .from('people')
    .select(`
      properties_as_seller:properties!seller_id(id, reference, title, zone, typology, price),
      properties_as_buyer:properties!buyer_id(id, reference, title, zone, typology, price),
      property_consultants(properties(id, reference, title, zone, typology, price))
    `)
    .eq('id', personId)
    .eq('agency_id', agencyId)
    .maybeSingle()

  if (!data) return []
  const seller = (data.properties_as_seller ?? []) as ContactPropertyCandidate[]
  const buyer = (data.properties_as_buyer ?? []) as ContactPropertyCandidate[]
  const consultant = ((data.property_consultants ?? []) as { properties: ContactPropertyCandidate | null }[])
    .map(pc => pc.properties)
    .filter((p): p is ContactPropertyCandidate => !!p)

  const byId = new Map<string, ContactPropertyCandidate>()
  for (const p of [...seller, ...buyer, ...consultant]) byId.set(p.id, p)
  return [...byId.values()]
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/pipeline/resolve-contact-property.ts
git commit -m "feat: add helper to resolve a contact's associated properties"
```

---

### Task 2: `POST /api/people/[id]/pipeline` liga o imóvel certo

**Files:**
- Modify: `app/api/people/[id]/pipeline/route.ts`

- [ ] **Step 1: Importar a função e resolver o imóvel antes do insert**

No topo do ficheiro, trocar:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
```

por:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveContactPropertyCandidates } from '@/lib/pipeline/resolve-contact-property'
```

Na função `POST`, imediatamente antes de `const { data: firstStage } = await supabase` (a query da 1ª etapa), adicionar:

```ts
  // Sem `property_id` no body → resolve automaticamente quando só há 1
  // imóvel candidato; com 2+, o cliente já perguntou ao consultor e manda
  // o `property_id` escolhido (ou null, se escolheu "sem imóvel").
  const hasPropertyOverride = Object.prototype.hasOwnProperty.call(body, 'property_id')
  let propertyId: string | null = hasPropertyOverride && typeof body.property_id === 'string' ? body.property_id : null
  if (!hasPropertyOverride) {
    const candidates = await resolveContactPropertyCandidates(supabase, profile.agency_id, id)
    if (candidates.length === 1) propertyId = candidates[0].id
  }

  let propertyZone: string | null = null
  let propertyTypology: string | null = null
  let propertyBudget: number | null = null
  if (propertyId) {
    const { data: property } = await supabase
      .from('properties')
      .select('zone, typology, price')
      .eq('id', propertyId)
      .eq('agency_id', profile.agency_id)
      .maybeSingle()
    if (property) {
      propertyZone = property.zone
      propertyTypology = property.typology
      propertyBudget = property.price
    }
  }
```

- [ ] **Step 2: Usar os valores resolvidos no insert**

Trocar:

```ts
  const details = (person.details ?? {}) as Record<string, unknown>
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      agency_id: profile.agency_id,
      pipeline_id: pipelineId,
      name: person.name,
      email: person.email,
      phone: person.phone,
      stage_id: firstStage.id,
      person_id: person.id,
      assigned_to: person.assigned_to ?? user.id,
      zone: (details.search_zone ?? details.selling_zone ?? null) as string | null,
      typology: (details.typology ?? null) as string | null,
      source: 'outro',
    })
    .select('id')
    .single()
```

por:

```ts
  const details = (person.details ?? {}) as Record<string, unknown>
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      agency_id: profile.agency_id,
      pipeline_id: pipelineId,
      name: person.name,
      email: person.email,
      phone: person.phone,
      stage_id: firstStage.id,
      person_id: person.id,
      property_id: propertyId,
      assigned_to: person.assigned_to ?? user.id,
      zone: propertyZone ?? ((details.search_zone ?? details.selling_zone ?? null) as string | null),
      typology: propertyTypology ?? ((details.typology ?? null) as string | null),
      budget: propertyBudget,
      source: 'outro',
    })
    .select('id')
    .single()
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/api/people/\[id\]/pipeline/route.ts
git commit -m "fix: link the contact's associated property when adding to a pipeline"
```

---

### Task 3: `POST /api/pipelines/[id]/add-contacts` liga o imóvel certo em lote

**Files:**
- Modify: `app/api/pipelines/[id]/add-contacts/route.ts`

- [ ] **Step 1: Importar a função**

No topo do ficheiro, trocar:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
```

por:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveContactPropertyCandidates } from '@/lib/pipeline/resolve-contact-property'
```

- [ ] **Step 2: Ler `property_choices` do body**

Trocar:

```ts
  const body = await request.json().catch(() => ({}))
  const personIds: string[] = Array.isArray(body.person_ids)
    ? body.person_ids.filter((v: unknown): v is string => typeof v === 'string')
    : []
  if (personIds.length === 0) return NextResponse.json({ added: 0 })
```

por:

```ts
  const body = await request.json().catch(() => ({}))
  const personIds: string[] = Array.isArray(body.person_ids)
    ? body.person_ids.filter((v: unknown): v is string => typeof v === 'string')
    : []
  if (personIds.length === 0) return NextResponse.json({ added: 0 })

  // Escolhas explícitas do cliente para contactos com 2+ imóveis candidatos
  // (perguntadas no ContactPickerModal antes de submeter). Valor `null`
  // significa "sem imóvel", escolhido deliberadamente.
  const propertyChoices: Record<string, string | null> = (body.property_choices && typeof body.property_choices === 'object')
    ? body.property_choices
    : {}
```

- [ ] **Step 3: Substituir a construção síncrona de `rows` por uma versão assíncrona que resolve o imóvel de cada pessoa**

Trocar:

```ts
  const { data: people } = await supabase
    .from('people')
    .select('id, name, email, phone, details')
    .eq('agency_id', profile.agency_id)
    .in('id', toAdd)

  const rows = (people ?? []).map(person => {
    const details = (person.details ?? {}) as Record<string, unknown>
    return {
      agency_id: profile.agency_id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      stage_id: firstStage.id,
      pipeline_id: pipelineId,
      person_id: person.id,
      property_id: null,
      assigned_to: user.id,
      zone: (details.search_zone ?? details.selling_zone ?? null) as string | null,
      typology: (details.typology ?? null) as string | null,
      source: 'outro',
    }
  })

  if (rows.length === 0) return NextResponse.json({ added: 0 })
```

por:

```ts
  const { data: people } = await supabase
    .from('people')
    .select('id, name, email, phone, details')
    .eq('agency_id', profile.agency_id)
    .in('id', toAdd)

  // Imóveis escolhidos explicitamente (não nulos) — preciso de zone/typology/price
  // para copiar para a lead, tal como o add-properties já faz.
  const explicitIds = [...new Set(Object.values(propertyChoices).filter((v): v is string => typeof v === 'string'))]
  const { data: explicitProperties } = explicitIds.length > 0
    ? await supabase.from('properties').select('id, zone, typology, price').eq('agency_id', profile.agency_id).in('id', explicitIds)
    : { data: [] as { id: string; zone: string | null; typology: string | null; price: number | null }[] }
  const explicitPropertyById = new Map((explicitProperties ?? []).map(p => [p.id, p]))

  const rows = await Promise.all((people ?? []).map(async person => {
    const details = (person.details ?? {}) as Record<string, unknown>
    const hasChoice = Object.prototype.hasOwnProperty.call(propertyChoices, person.id)

    let propertyId: string | null = null
    let propertyZone: string | null = null
    let propertyTypology: string | null = null
    let propertyBudget: number | null = null

    if (hasChoice) {
      propertyId = propertyChoices[person.id]
      if (propertyId) {
        const property = explicitPropertyById.get(propertyId)
        if (property) {
          propertyZone = property.zone
          propertyTypology = property.typology
          propertyBudget = property.price
        }
      }
    } else {
      const candidates = await resolveContactPropertyCandidates(supabase, profile.agency_id, person.id)
      if (candidates.length === 1) {
        propertyId = candidates[0].id
        propertyZone = candidates[0].zone
        propertyTypology = candidates[0].typology
        propertyBudget = candidates[0].price
      }
    }

    return {
      agency_id: profile.agency_id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      stage_id: firstStage.id,
      pipeline_id: pipelineId,
      person_id: person.id,
      property_id: propertyId,
      assigned_to: user.id,
      zone: propertyZone ?? ((details.search_zone ?? details.selling_zone ?? null) as string | null),
      typology: propertyTypology ?? ((details.typology ?? null) as string | null),
      budget: propertyBudget,
      source: 'outro',
    }
  }))

  if (rows.length === 0) return NextResponse.json({ added: 0 })
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/api/pipelines/\[id\]/add-contacts/route.ts
git commit -m "fix: link contacts' associated properties when bulk-adding to a pipeline"
```

---

### Task 4: `ContactDetailPanel` — escolher imóvel ao adicionar a pipelines

**Files:**
- Modify: `components/contacts/ContactDetailPanel.tsx`

- [ ] **Step 1: Calcular os imóveis candidatos do contacto**

Depois da linha (verificar com `grep -n "missingPipelines = pipelines.filter" components/contacts/ContactDetailPanel.tsx` que continua na mesma linha antes de editar):

```tsx
  const missingPipelines = pipelines.filter(p => !activeLeads.some(l => l.pipeline_id === p.id))
```

adicionar logo a seguir:

```tsx
  // Imóveis já associados a este contacto (vendedor, comprador candidato ou
  // consultor) — candidatos a ligar ao card quando se adiciona a uma
  // pipeline. Com 2+, o consultor escolhe qual usar antes de confirmar.
  const candidateProperties: PropertyRef[] = (() => {
    const seller = person.properties_as_seller ?? []
    const buyer = person.properties_as_buyer ?? []
    const consultant = (person.property_consultants ?? []).map(pc => pc.properties)
    const byId = new Map<string, PropertyRef>()
    for (const p of [...seller, ...buyer, ...consultant]) byId.set(p.id, p)
    return [...byId.values()]
  })()
```

- [ ] **Step 2: Novo estado `propertyChoice`**

Trocar:

```tsx
  const [pipelineMenuOpen, setPipelineMenuOpen] = useState(false)
  const [pipelineSelection, setPipelineSelection] = useState<string[]>([])
```

por:

```tsx
  const [pipelineMenuOpen, setPipelineMenuOpen] = useState(false)
  const [pipelineSelection, setPipelineSelection] = useState<string[]>([])
  const [propertyChoice, setPropertyChoice] = useState('')
```

- [ ] **Step 3: `addToPipelines` aceita o imóvel escolhido**

Trocar:

```tsx
  async function addToPipelines(pipelineIds: string[]) {
    if (pipelineIds.length === 0) return
    setPipelineBusy(true)
    setPipelineMenuOpen(false)
    try {
      const results = await Promise.allSettled(
        pipelineIds.map(pipelineId =>
          fetch(`/api/people/${id}/pipeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pipeline_id: pipelineId }),
          })
        )
      )
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length
      if (failed > 0) {
        alert(`${failed} de ${pipelineIds.length} pipeline(s) não foram adicionadas.`)
      }
      fetchPerson(); onChanged?.()
    } finally {
      setPipelineBusy(false)
      setPipelineSelection([])
    }
  }
```

por:

```tsx
  async function addToPipelines(pipelineIds: string[], propertyId?: string | null) {
    if (pipelineIds.length === 0) return
    setPipelineBusy(true)
    setPipelineMenuOpen(false)
    try {
      const results = await Promise.allSettled(
        pipelineIds.map(pipelineId =>
          fetch(`/api/people/${id}/pipeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pipeline_id: pipelineId, ...(propertyId !== undefined ? { property_id: propertyId } : {}) }),
          })
        )
      )
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length
      if (failed > 0) {
        alert(`${failed} de ${pipelineIds.length} pipeline(s) não foram adicionadas.`)
      }
      fetchPerson(); onChanged?.()
    } finally {
      setPipelineBusy(false)
      setPipelineSelection([])
      setPropertyChoice('')
    }
  }
```

- [ ] **Step 4: Mostrar o seletor de imóvel no popup "+ Pipeline" quando há ambiguidade**

Trocar:

```tsx
                  <button
                    type="button"
                    disabled={pipelineSelection.length === 0}
                    onClick={() => addToPipelines(pipelineSelection)}
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 6 }}
                  >
                    Adicionar
                  </button>
```

por:

```tsx
                  {candidateProperties.length >= 2 && (
                    <select
                      className="input"
                      value={propertyChoice}
                      onChange={e => setPropertyChoice(e.target.value)}
                      style={{ fontSize: 'var(--fs-sm)', padding: '4px 6px', marginTop: 4 }}
                    >
                      <option value="">Sem imóvel</option>
                      {candidateProperties.map(p => (
                        <option key={p.id} value={p.id}>{p.reference ? `${p.reference} — ${p.title}` : p.title}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={pipelineSelection.length === 0}
                    onClick={() => addToPipelines(pipelineSelection, candidateProperties.length >= 2 ? (propertyChoice || null) : undefined)}
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 6 }}
                  >
                    Adicionar
                  </button>
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/contacts/ContactDetailPanel.tsx
git commit -m "feat: ask which property to link when a contact has multiple associated"
```

---

### Task 5: `ContactPickerModal` — passo "Qual imóvel?" no "+ Contactos"

**Files:**
- Modify: `components/pipeline/ContactPickerModal.tsx`

- [ ] **Step 1: Substituir o ficheiro inteiro**

Conteúdo completo de `components/pipeline/ContactPickerModal.tsx`:

```tsx
'use client'
import { useState, useEffect, useMemo } from 'react'
import type { Person } from '@/types'

type PropertyRef = { id: string; title: string; reference: string | null }
type PersonWithProperties = Person & {
  properties_as_seller?: PropertyRef[]
  properties_as_buyer?: PropertyRef[]
  property_consultants?: { properties: PropertyRef }[]
}
type Ambiguous = { id: string; name: string; properties: PropertyRef[] }

function candidatesOf(person: PersonWithProperties): PropertyRef[] {
  const seller = person.properties_as_seller ?? []
  const buyer = person.properties_as_buyer ?? []
  const consultant = (person.property_consultants ?? []).map(pc => pc.properties)
  const byId = new Map<string, PropertyRef>()
  for (const p of [...seller, ...buyer, ...consultant]) byId.set(p.id, p)
  return [...byId.values()]
}

// Popup: lista de contactos A-Z, pesquisa por nome ou telefone, checkbox
// por linha. Os contactos já ativos nesta pipeline aparecem marcados e
// desativados (para os duplicar, usa-se o botão "Duplicar" no card, não
// este picker). Contactos com 2+ imóveis associados (vendedor, comprador
// candidato ou consultor) passam por um segundo passo a perguntar qual
// imóvel ligar a cada card novo — sem isso o card fica sem imóvel e a
// configuração de "info principal/secundária" (quando é 'property') não
// mostra nada nesse card.
export function ContactPickerModal({ pipelineId, pipelineName, alreadyInIds, onClose, onAdded }: {
  pipelineId: string
  pipelineName: string
  alreadyInIds: Set<string>
  onClose: () => void
  onAdded: () => void
}) {
  const [people, setPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'select' | 'choose-property'>('select')
  const [ambiguous, setAmbiguous] = useState<Ambiguous[]>([])
  const [propertyChoices, setPropertyChoices] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/people')
      .then(r => r.ok ? r.json() : [])
      .then((data: Person[]) => setPeople(
        [...data].sort((a, b) => a.name.trim().localeCompare(b.name.trim(), 'pt'))
      ))
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return people
    const digits = term.replace(/\D/g, '')
    return people.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (digits && (() => { const stored = (p.phone ?? '').replace(/\D/g, ''); return !!stored && (stored.includes(digits) || digits.includes(stored)) })())
    )
  }, [people, search])

  function toggle(id: string) {
    if (alreadyInIds.has(id)) return
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function submitAdd(propertyChoicesBody?: Record<string, string | null>) {
    const res = await fetch(`/api/pipelines/${pipelineId}/add-contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person_ids: [...checked], ...(propertyChoicesBody ? { property_choices: propertyChoicesBody } : {}) }),
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({})) as { added?: number }
      if (typeof data.added === 'number' && data.added < checked.size) {
        alert(`${data.added} de ${checked.size} contacto(s) foram adicionados — os restantes já estavam ativos nesta pipeline.`)
      }
      onAdded()
      onClose()
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string }
      alert(d.error ?? 'Erro ao adicionar contactos.')
    }
  }

  async function confirm() {
    if (checked.size === 0) { onClose(); return }
    setSaving(true)
    try {
      const details = await Promise.all(
        [...checked].map(id => fetch(`/api/people/${id}`).then(r => r.ok ? r.json() as Promise<PersonWithProperties> : null))
      )
      const found = details.filter((p): p is PersonWithProperties => !!p)
      const withAmbiguity = found
        .map(p => ({ id: p.id, name: p.name, properties: candidatesOf(p) }))
        .filter(p => p.properties.length >= 2)

      if (withAmbiguity.length === 0) {
        await submitAdd()
        return
      }
      setAmbiguous(withAmbiguity)
      setPropertyChoices(Object.fromEntries(withAmbiguity.map(p => [p.id, ''])))
      setStep('choose-property')
    } finally {
      setSaving(false)
    }
  }

  async function confirmWithProperties() {
    setSaving(true)
    try {
      const propertyChoicesBody: Record<string, string | null> = {}
      for (const a of ambiguous) propertyChoicesBody[a.id] = propertyChoices[a.id] || null
      await submitAdd(propertyChoicesBody)
    } finally {
      setSaving(false)
    }
  }

  if (step === 'choose-property') {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div className="font-display" style={{ fontSize: 16 }}>Qual imóvel?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Estes contactos têm mais do que um imóvel associado — escolhe qual ligar a cada card novo.</div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ambiguous.map(a => (
              <div key={a.id}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{a.name}</div>
                <select
                  className="input"
                  value={propertyChoices[a.id] ?? ''}
                  onChange={e => setPropertyChoices(prev => ({ ...prev, [a.id]: e.target.value }))}
                >
                  <option value="">Sem imóvel</option>
                  {a.properties.map(p => (
                    <option key={p.id} value={p.id}>{p.reference ? `${p.reference} — ${p.title}` : p.title}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setStep('select')} className="btn btn-ghost" style={{ flex: 1 }}>← Voltar</button>
            <button onClick={confirmWithProperties} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? 'A adicionar…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="font-display" style={{ fontSize: 16 }}>Adicionar contactos <span style={{ color: 'var(--muted)', fontSize: 12 }}>→ {pipelineName}</span></div>
            <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <input className="input" placeholder="Pesquisar por nome ou telefone…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '8px 10px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Nenhum contacto encontrado.</div>
          ) : filtered.map(p => {
            const isIn = alreadyInIds.has(p.id)
            const isChecked = isIn || checked.has(p.id)
            return (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: isIn ? 'default' : 'pointer', opacity: isIn ? 0.5 : 1 }}>
                <input type="checkbox" checked={isChecked} disabled={isIn} onChange={() => toggle(p.id)} style={{ width: 15, height: 15, accentColor: '#B07D2E', cursor: isIn ? 'default' : 'pointer' }} />
                <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                {isIn && <span style={{ fontSize: 10, color: 'var(--muted)' }}>já na pipeline</span>}
              </label>
            )
          })}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
          <button onClick={confirm} disabled={saving || checked.size === 0} className="btn btn-primary" style={{ flex: 1 }}>
            {saving ? 'A verificar…' : `Adicionar${checked.size > 0 ? ` (${checked.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/ContactPickerModal.tsx
git commit -m "feat: ask which property to use for contacts with multiple associated in bulk add"
```

---

### Task 6: Ícone 🏠 no card para escolher/trocar o imóvel

**Files:**
- Create: `components/pipeline/CardPropertyModal.tsx`
- Modify: `components/pipeline/KanbanBoard.tsx`
- Modify: `components/pipeline/PipelineBoard.tsx`

- [ ] **Step 1: Criar o modal de pesquisa de imóvel**

Conteúdo completo de `components/pipeline/CardPropertyModal.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import type { Property } from '@/types'

// Popup para escolher/trocar o imóvel de um card específico da pipeline —
// pesquisa em toda a carteira da agência (não só os imóveis já associados
// ao contacto), tal como o picker de comprador em PropertyBuyer.tsx.
export function CardPropertyModal({ currentPropertyId, currentPropertyLabel, onClose, onSelect, onRemove }: {
  currentPropertyId: string | null
  currentPropertyLabel: string | null
  onClose: () => void
  onSelect: (property: Property) => void
  onRemove: () => void
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Property[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/properties?search=${encodeURIComponent(search.trim())}`)
      setResults(res.ok ? await res.json() : [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: '100%', maxWidth: 420, maxHeight: '75vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="font-display" style={{ fontSize: 16 }}>Imóvel do card</div>
            <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          {currentPropertyLabel && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <span style={{ fontSize: 12 }}>{currentPropertyLabel}</span>
              <button onClick={onRemove} className="btn btn-danger btn-sm" style={{ padding: '2px 8px' }}>Remover</button>
            </div>
          )}
          <input className="input" placeholder="Pesquisar imóvel por referência, título ou morada…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '8px 10px' }}>
          {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>A procurar…</div>}
          {!loading && search.trim() && results.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Nenhum imóvel encontrado.</div>
          )}
          {!loading && results.filter(p => p.id !== currentPropertyId).map(p => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="table-row"
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 4, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.reference ? `${p.reference} — ${p.title}` : p.title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.price ? `€${p.price.toLocaleString('pt-PT')}` : ''} {p.zone ?? ''}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `LeadCard` ganha o ícone 🏠 e passa a chamada para o pai**

Em `components/pipeline/KanbanBoard.tsx`, trocar a assinatura de `LeadCard`:

```tsx
function LeadCard({ lead, isDragging, onOpenContact, cardFields, onDuplicated }: { lead: Lead; isDragging?: boolean; onOpenContact?: (personId: string, leadId: string) => void; cardFields: PipelineCardFields; onDuplicated?: () => void }) {
```

por:

```tsx
function LeadCard({ lead, isDragging, onOpenContact, cardFields, onDuplicated, onEditProperty }: { lead: Lead; isDragging?: boolean; onOpenContact?: (personId: string, leadId: string) => void; cardFields: PipelineCardFields; onDuplicated?: () => void; onEditProperty?: (lead: Lead) => void }) {
```

Trocar o botão de duplicar:

```tsx
          <button
            onClick={duplicateCard}
            disabled={duplicating}
            title="Duplicar card"
            className="icon-btn"
            style={{ width: 20, height: 20, fontSize: 11, flexShrink: 0 }}
          >
            ⧉
          </button>
```

por (novo botão 🏠 a seguir):

```tsx
          <button
            onClick={duplicateCard}
            disabled={duplicating}
            title="Duplicar card"
            className="icon-btn"
            style={{ width: 20, height: 20, fontSize: 11, flexShrink: 0 }}
          >
            ⧉
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEditProperty?.(lead) }}
            title="Imóvel do card"
            className="icon-btn"
            style={{ width: 20, height: 20, fontSize: 11, flexShrink: 0 }}
          >
            🏠
          </button>
```

- [ ] **Step 3: `KanbanBoard` gere o modal e o `PATCH`**

Trocar a assinatura de `Props` e da função `KanbanBoard`:

```tsx
type Props = {
  initialLeads: Lead[]
  stages: PipelineStage[]
  onOpenContact?: (personId: string, leadId: string) => void
  cardFields: PipelineCardFields
  onDuplicated?: () => void
}

export function KanbanBoard({ initialLeads, stages, onOpenContact, cardFields, onDuplicated }: Props) {
  const [leads, setLeads] = useState(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
```

por:

```tsx
type Props = {
  initialLeads: Lead[]
  stages: PipelineStage[]
  onOpenContact?: (personId: string, leadId: string) => void
  cardFields: PipelineCardFields
  onDuplicated?: () => void
  onCardUpdated?: () => void
}

export function KanbanBoard({ initialLeads, stages, onOpenContact, cardFields, onDuplicated, onCardUpdated }: Props) {
  const [leads, setLeads] = useState(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingProperty, setEditingProperty] = useState<Lead | null>(null)

  async function updateCardProperty(patch: { property_id: string | null; zone?: string | null; typology?: string | null; budget?: number | null }) {
    if (!editingProperty) return
    const res = await fetch(`/api/leads/${editingProperty.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setEditingProperty(null)
    if (res.ok) onCardUpdated?.()
  }
```

Adicionar `import { CardPropertyModal } from '@/components/pipeline/CardPropertyModal'` e `import type { Property } from '@/types'` ao topo do ficheiro, a seguir a `import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'`.

Nas duas chamadas a `<LeadCard ... />` (dentro do `map` das colunas e no `DragOverlay`), acrescentar `onEditProperty={setEditingProperty}`.

Isto exige envolver o `return` inteiro de `KanbanBoard` num fragment. Trocar a linha de abertura:

```tsx
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="stagger kanban-board" style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0', minHeight: 'calc(100vh - 140px)' }}>
```

por:

```tsx
  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="stagger kanban-board" style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0', minHeight: 'calc(100vh - 140px)' }}>
```

No final do `return` de `KanbanBoard`, trocar:

```tsx
      <DragOverlay>
        {activeLead && <LeadCard lead={activeLead} onOpenContact={onOpenContact} cardFields={cardFields} onDuplicated={onDuplicated} />}
      </DragOverlay>
    </DndContext>
  )
}
```

por:

```tsx
        <DragOverlay>
          {activeLead && <LeadCard lead={activeLead} onOpenContact={onOpenContact} cardFields={cardFields} onDuplicated={onDuplicated} onEditProperty={setEditingProperty} />}
        </DragOverlay>
      </DndContext>
      {editingProperty && (
        <CardPropertyModal
          currentPropertyId={editingProperty.property_id}
          currentPropertyLabel={editingProperty.properties ? (editingProperty.properties.reference ?? editingProperty.properties.title) : null}
          onClose={() => setEditingProperty(null)}
          onSelect={(property: Property) => updateCardProperty({ property_id: property.id, zone: property.zone, typology: property.typology, budget: property.price })}
          onRemove={() => updateCardProperty({ property_id: null })}
        />
      )}
    </>
  )
}
```

Nota: isto deixa o `.map(stage => ...)` das colunas (entre a abertura do `<DndContext>` e o `<DragOverlay>`, inalterado por esta task) com 2 espaços a menos de indentação do que o resto do bloco — é só uma inconsistência cosmética (o projeto não tem regra de lint para indentação, `eslint.config.mjs` só usa `eslint-config-next/core-web-vitals` e `/typescript`), não impede o build nem o `npx tsc --noEmit`. Não é preciso reindentar esse bloco à mão.

- [ ] **Step 4: `PipelineBoard.tsx` passa `onCardUpdated`**

Trocar:

```tsx
            onDuplicated={() => selectedId && loadBoard(selectedId)}
```

por:

```tsx
            onDuplicated={() => selectedId && loadBoard(selectedId)}
            onCardUpdated={() => selectedId && loadBoard(selectedId)}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/pipeline/CardPropertyModal.tsx components/pipeline/KanbanBoard.tsx components/pipeline/PipelineBoard.tsx
git commit -m "feat: allow changing a pipeline card's associated property from an icon"
```

---

### Task 7: Layout do card — coluna mais larga e texto em 2 linhas

**Files:**
- Modify: `components/pipeline/KanbanBoard.tsx`

- [ ] **Step 1: Coluna mais larga**

Trocar:

```tsx
            <div key={stage.id} id={stage.id} style={{ minWidth: 240, width: 240, flexShrink: 0 }}>
```

por:

```tsx
            <div key={stage.id} id={stage.id} style={{ minWidth: 300, width: 300, flexShrink: 0 }}>
```

- [ ] **Step 2: Texto principal em até 2 linhas em vez de cortar com "..."**

Trocar:

```tsx
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primaryText}</div>
```

por:

```tsx
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, whiteSpace: 'normal', wordBreak: 'break-word' as const }}>{primaryText}</div>
```

- [ ] **Step 3: Texto secundário em até 2 linhas**

Trocar:

```tsx
        {secondaryText && secondaryText !== primaryText && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondaryText}</div>
        )}
```

por:

```tsx
        {secondaryText && secondaryText !== primaryText && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, whiteSpace: 'normal', wordBreak: 'break-word' as const }}>{secondaryText}</div>
        )}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add components/pipeline/KanbanBoard.tsx
git commit -m "fix: widen pipeline columns and wrap card text instead of truncating"
```

---

### Task 8: Verificação final

- [ ] **Step 1: Type check completo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build completa sem erros.

- [ ] **Step 3: Lint sobre os ficheiros tocados neste plano**

Run:
```bash
npx eslint lib/pipeline/resolve-contact-property.ts "app/api/people/[id]/pipeline/route.ts" "app/api/pipelines/[id]/add-contacts/route.ts" components/contacts/ContactDetailPanel.tsx components/pipeline/ContactPickerModal.tsx components/pipeline/CardPropertyModal.tsx components/pipeline/KanbanBoard.tsx components/pipeline/PipelineBoard.tsx
```
Expected: nenhum erro/aviso novo introduzido por este plano.

- [ ] **Step 4: Verificação manual no browser**

Iniciar o dev server (`npm run dev` / preview) e, com sessão autenticada numa agência com dados de teste:
1. Abrir um contacto com 2+ imóveis associados (vendedor/comprador/consultor) na ficha de contacto → "+ Pipeline" → confirmar que aparece o seletor "Qual imóvel?" e que o card criado mostra o imóvel certo (com a pipeline configurada para `card_primary_field` ou `card_secondary_field` = `property`).
2. Repetir o mesmo cenário via "+ Contactos" na pipeline (seleção em lote) → confirmar o passo extra "Qual imóvel?".
3. No Kanban, clicar no ícone 🏠 de um card e trocar o imóvel → confirmar que o card atualiza e que o clique no resto do card continua a abrir o contacto/lead normalmente.
4. Confirmar visualmente que as colunas ficaram mais largas e que um imóvel com título longo (ex: "Apartamento T3 Cascais Renovado com Vista Mar") quebra em 2 linhas em vez de cortar com "...", tanto em desktop como em mobile (`resize_window` preset `mobile`).
5. Na ficha do imóvel usado no passo 1/2, confirmar que "Negociações em curso" agora lista o card criado.

Expected: todos os pontos acima confirmados sem erros de consola.

- [ ] **Step 5: Revisão holística**

Dispatch de um review final (subagent `superpowers:code-reviewer`) comparando o diff completo desde antes da Task 1 até ao HEAD contra a spec `docs/superpowers/specs/2026-07-26-pipeline-cards-imovel-design.md`, à procura de interações entre tasks (ex: o ícone 🏠 (Task 6) e o botão de duplicar (⧉, já existente) não devem disparar o `onClick` do card nem um ao outro; o `add-contacts` (Task 3) resolvendo candidatos por pessoa em série não deve estourar tempo de resposta para lotes grandes — se a spec não definir um limite, confirmar que o comportamento é aceitável para lotes típicos de poucas dezenas de contactos).
