# Imóvel ↔ Comprador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registar quem comprou um imóvel (`buyer_id`), ver quem está a negociá-lo (leads ativas com esse imóvel) com atalho "Foi este o comprador", e o recíproco "Imóveis comprados" na ficha do contacto.

**Architecture:** Uma coluna nova (`properties.buyer_id`); tudo o resto é join + UI. O PATCH de properties é passthrough (`update(body)`), por isso aceita `buyer_id` sem alterações. `PropertyBuyer` espelha o `PropertySeller` existente; `PropertyNegotiations` deriva das leads com `property_id` (novo filtro no GET de leads).

**Tech Stack:** Next.js 16, React 19, Supabase. **Sem framework de testes** — verificação é `npx tsc --noEmit` + preview. Branch: criar `claude/imovel-comprador` a partir de `claude/notificacoes-etapa`. **Sem push** (pedido do utilizador — push de tudo só no fim).

**Spec:** `docs/superpowers/specs/2026-07-19-imovel-comprador-design.md`

---

## Mapa de ficheiros

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260719_property_buyer.sql` | Criar | Coluna buyer_id + índice |
| `types/index.ts` | Modificar | `buyer_id` (+ join `buyer?`) no tipo `Property` |
| `app/api/properties/[id]/route.ts` | Modificar | GET junta `buyer` |
| `app/api/people/[id]/route.ts` | Modificar | GET junta `properties_as_buyer` |
| `app/api/leads/route.ts` | Modificar | GET aceita `?property_id=` + junta `pipelines(name)` |
| `components/properties/PropertyBuyer.tssx→tsx` | Criar | Cartão "Comprador" (espelho do Vendedor) |
| `components/properties/PropertyNegotiations.tsx` | Criar | Cartão "Negociações em curso" |
| `app/(app)/properties/[id]/page.tsx` | Modificar | Renderiza os dois cartões |
| `components/contacts/ContactDetailPanel.tsx` | Modificar | Cartão "Imóveis comprados" |

## Factos do código (verificados — não re-descobrir)

- `GET /api/properties/[id]` seleciona `*, seller:people!seller_id(id, name, phone, email), ...` — o join do buyer segue o mesmo formato.
- `PATCH /api/properties/[id]` faz `update(body)` direto (sem allowlist) — `buyer_id` e `status` passam sem alterações à rota.
- `PropertySeller` (`components/properties/PropertySeller.tsx`) é o molde exato: pesquisa `/api/people?search=`, `setSeller(id|null)` via PATCH, estilos `labelStyle`/`inputStyle` locais, cartão `background: var(--card)`.
- `GET /api/leads` já filtra por `stage_id`/`person_id`/`pipeline_id` com o padrão `if (x) query = query.eq(...)`; o select atual junta `pipeline_stages(...)` e `people(...)` mas NÃO `pipelines`.
- A página do imóvel tem a coluna direita com `<PropertySeller .../>`, `<PropertyConsultants .../>`, `<SuggestedBuyers .../>`, etc.
- No `ContactDetailPanel`, `PersonDetail` já tem `properties_as_seller?: PropertyRef[]`; `PropertyRef = { id, title, status, price, reference }`; `cardTitle(...)` helper existe.

---

### Task 1: Migração, tipos e APIs

**Files:**
- Create: `supabase/migrations/20260719_property_buyer.sql`
- Modify: `types/index.ts`
- Modify: `app/api/properties/[id]/route.ts`
- Modify: `app/api/people/[id]/route.ts`
- Modify: `app/api/leads/route.ts`

- [ ] **Step 0: Branch**

```bash
git checkout -b claude/imovel-comprador
```

- [ ] **Step 1: Migração** (ficheiro apenas — o coordenador aplica via MCP na Task 4):

```sql
-- Comprador (contacto) do imóvel — quem comprou, quando vendido.
alter table public.properties
  add column buyer_id uuid references public.people(id) on delete set null;

create index properties_buyer_idx on public.properties(buyer_id);
```

- [ ] **Step 2: Tipo `Property`** — em `types/index.ts`, no tipo `Property`, depois de `seller_id` (se existir no tipo; senão depois de `notes`), acrescentar:

```ts
  buyer_id?: string | null
  buyer?: { id: string; name: string; phone: string | null; email: string | null } | null
```

(Verificar se o tipo já declara `seller_id`/`seller` e seguir o mesmo posicionamento/estilo.)

- [ ] **Step 3: GET properties junta buyer** — em `app/api/properties/[id]/route.ts`, no select do GET, acrescentar à lista de joins (junto ao seller):

```
buyer:people!buyer_id(id, name, phone, email),
```

- [ ] **Step 4: GET people junta properties_as_buyer** — em `app/api/people/[id]/route.ts`, no select do GET, acrescentar (junto ao `properties_as_seller`):

```
properties_as_buyer:properties!buyer_id(id, title, status, price, reference),
```

- [ ] **Step 5: GET leads aceita property_id + junta pipelines(name)** — em `app/api/leads/route.ts` (GET):

```ts
  const propertyId = searchParams.get('property_id')
```

junto aos outros `searchParams.get`, e junto aos outros filtros:

```ts
  if (propertyId) query = query.eq('property_id', propertyId)
```

E no select, acrescentar `pipelines(name)` à lista de joins (ex.: a seguir a `pipeline_stages(...)`).

Nota: o tipo `Lead` já tem `pipeline_id`; acrescentar em `types/index.ts` ao tipo `Lead` (junto aos joins opcionais `pipeline_stages?` etc.):

```ts
  pipelines?: { name: string } | null
```

- [ ] **Step 6: Type-check e commit**

```bash
npx tsc --noEmit
git add supabase/migrations/20260719_property_buyer.sql types/index.ts "app/api/properties/[id]/route.ts" "app/api/people/[id]/route.ts" app/api/leads/route.ts
git commit -m "feat: buyer_id no imóvel + joins e filtro property_id (BD/APIs)"
```

---

### Task 2: Cartões "Comprador" e "Negociações em curso" na ficha do imóvel

**Files:**
- Create: `components/properties/PropertyBuyer.tsx`
- Create: `components/properties/PropertyNegotiations.tsx`
- Modify: `app/(app)/properties/[id]/page.tsx`

- [ ] **Step 1: `PropertyBuyer`** — conteúdo completo (espelho do `PropertySeller`, com aviso vendido-sem-comprador):

```tsx
// components/properties/PropertyBuyer.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Person, PropertyStatus } from '@/types'

type Buyer = { id: string; name: string; phone: string | null; email: string | null }

export function PropertyBuyer({ propertyId, buyer, status, onChange }: {
  propertyId: string
  buyer: Buyer | null
  status: PropertyStatus
  onChange: () => void
}) {
  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)

  async function doSearch(q: string) {
    setSearch(q)
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/people?search=${encodeURIComponent(q.trim())}`)
      if (res.ok) setResults(await res.json())
    } finally { setLoading(false) }
  }

  async function setBuyer(buyerId: string | null) {
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyer_id: buyerId }),
    })
    if (res.ok) { setPicking(false); setSearch(''); setResults([]); onChange() }
  }

  const labelStyle = { fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }
  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="font-display" style={{ fontSize: 15 }}>Comprador</div>
        {!picking && (
          <button onClick={() => setPicking(true)} className="btn btn-soft btn-sm">
            {buyer ? 'Alterar' : 'Definir'}
          </button>
        )}
      </div>

      {!picking && (
        buyer ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Link href={`/people/${buyer.id}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>{buyer.name}</Link>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{buyer.phone || buyer.email || 'Sem contacto'}</div>
            </div>
            <button onClick={() => setBuyer(null)} className="btn btn-danger btn-sm" style={{ padding: '2px 8px' }}>Remover</button>
          </div>
        ) : status === 'vendido' ? (
          <div style={{ fontSize: 12, color: '#D97706', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 8, padding: '8px 12px' }}>
            Vendido — sem comprador registado.
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum comprador associado.</div>
        )
      )}

      {picking && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={labelStyle}>Procurar contacto</div>
          <input style={inputStyle} autoFocus placeholder="Nome, telefone ou email..." value={search} onChange={e => doSearch(e.target.value)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
            {loading && <div style={{ fontSize: 12, color: 'var(--muted)' }}>A procurar...</div>}
            {!loading && search.trim().length >= 2 && results.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum contacto encontrado.</div>}
            {results.map(p => (
              <button key={p.id} onClick={() => setBuyer(p.id)} className="table-row" style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.phone || p.email || ''}</div>
              </button>
            ))}
          </div>
          <button onClick={() => { setPicking(false); setSearch(''); setResults([]) }} className="btn btn-ghost" style={{ fontSize: 12, alignSelf: 'flex-start' }}>Cancelar</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `PropertyNegotiations`** — conteúdo completo:

```tsx
// components/properties/PropertyNegotiations.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { Lead } from '@/types'

// Leads ligadas a este imóvel: ativas ("quem está a negociar") e fechadas.
// Atalho "Foi este o comprador" define properties.buyer_id e, opcionalmente,
// marca o imóvel como vendido.
export function PropertyNegotiations({ propertyId, hasBuyer, onChange }: {
  propertyId: string
  hasBuyer: boolean
  onChange: () => void
}) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads?property_id=${propertyId}`)
      const data = res.ok ? await res.json() : []
      setLeads(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [propertyId])

  useEffect(() => { load() }, [load])

  const active = leads.filter(l => l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost)
  const won = leads.filter(l => l.pipeline_stages?.is_won)

  async function markBuyer(lead: Lead) {
    if (!lead.person_id) return
    setBusy(lead.id)
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer_id: lead.person_id }),
      })
      if (res.ok && confirm('Marcar o imóvel como vendido?')) {
        await fetch(`/api/properties/${propertyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'vendido' }),
        })
      }
      onChange()
    } finally { setBusy(null) }
  }

  if (loading || (active.length === 0 && won.length === 0)) return null

  const row = (lead: Lead, showButton: boolean) => {
    const stage = lead.pipeline_stages
    return (
      <div key={lead.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/leads/${lead.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textDecoration: 'none', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.people?.name ?? lead.name}
          </Link>
          {stage && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: `${stage.color}1A`, border: `1px solid ${stage.color}40`, color: stage.color, fontWeight: 600, flexShrink: 0 }}>
              {lead.pipelines?.name ? `${lead.pipelines.name} · ` : ''}{stage.name}
            </span>
          )}
        </div>
        {showButton && lead.person_id && (
          <button onClick={() => markBuyer(lead)} disabled={busy === lead.id} className="btn btn-soft btn-sm" style={{ marginTop: 8 }}>
            {busy === lead.id ? 'A associar…' : 'Foi este o comprador'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div className="font-display" style={{ fontSize: 15, marginBottom: 14 }}>Negociações em curso</div>
      {active.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sem negociações ativas.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map(l => row(l, true))}
        </div>
      )}
      {won.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>Negócios fechados</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {won.map(l => row(l, !hasBuyer))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Integração na página do imóvel** — em `app/(app)/properties/[id]/page.tsx`:

1. Imports:

```tsx
import { PropertyBuyer } from '@/components/properties/PropertyBuyer'
import { PropertyNegotiations } from '@/components/properties/PropertyNegotiations'
```

2. Na coluna direita, imediatamente DEPOIS de `<PropertySeller .../>`:

```tsx
          <PropertyBuyer propertyId={id} buyer={property.buyer ?? null} status={property.status} onChange={fetchProperty} />
          <PropertyNegotiations propertyId={id} hasBuyer={!!property.buyer_id} onChange={fetchProperty} />
```

(O tipo local da página para `property` pode precisar de incluir `buyer`/`buyer_id` — verificar como o `seller` é tipado nessa página e seguir o mesmo padrão.)

- [ ] **Step 4: Type-check e commit**

```bash
npx tsc --noEmit
git add components/properties/PropertyBuyer.tsx components/properties/PropertyNegotiations.tsx "app/(app)/properties/[id]/page.tsx"
git commit -m "feat: cartões Comprador e Negociações em curso na ficha do imóvel"
```

---

### Task 3: "Imóveis comprados" na ficha do contacto

**Files:**
- Modify: `components/contacts/ContactDetailPanel.tsx`

- [ ] **Step 1: Tipo e cartão**

1. No type `PersonDetail`, junto a `properties_as_seller?: PropertyRef[]`, acrescentar:

```tsx
  properties_as_buyer?: PropertyRef[]
```

2. Na coluna direita do painel, DEPOIS do bloco `{showSeller && <SellerProperties .../>}`, acrescentar:

```tsx
            {(person.properties_as_buyer ?? []).length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                {cardTitle('Imóveis comprados')}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(person.properties_as_buyer ?? []).map(p => (
                    <Link key={p.id} href={`/properties/${p.id}`} className="card card-hover" style={{ textDecoration: 'none', color: 'inherit', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, boxShadow: 'none' }}>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.reference ? `${p.reference} — ` : ''}{p.title}
                      </div>
                      {p.price != null && (
                        <div className="font-display" style={{ fontSize: 'var(--fs-md)', color: 'var(--gold)', whiteSpace: 'nowrap' }}>€{p.price.toLocaleString('pt-PT')}</div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
```

- [ ] **Step 2: Type-check e commit**

```bash
npx tsc --noEmit
git add components/contacts/ContactDetailPanel.tsx
git commit -m "feat: cartão Imóveis comprados na ficha do contacto"
```

---

### Task 4: Migração + verificação final (coordenador)

- [ ] **Step 1: Aplicar migração** via MCP Supabase (`apply_migration`, nome `property_buyer`, SQL do ficheiro da Task 1). Confirmar com `execute_sql`: `select column_name from information_schema.columns where table_name='properties' and column_name='buyer_id';`.

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Preview** (dados reais — associar e depois REMOVER as associações de teste)

1. Ficha de um imóvel: cartão "Comprador" com "Definir"; pesquisar contacto, associar → nome com link; "Remover" limpa.
2. Imóvel com status vendido e sem comprador → aviso âmbar "Vendido — sem comprador registado".
3. Imóvel com leads ativas ligadas (`property_id`) → cartão "Negociações em curso" com pipeline · etapa e link; botão "Foi este o comprador" define buyer (recusar o confirm de vendido para não mexer no status) → cartão Comprador atualiza.
4. Ficha do contacto usado no teste → cartão "Imóveis comprados" com o imóvel; abrir também via gaveta da pipeline (mesmo painel).
5. Limpar: remover o buyer de teste.
6. Consola sem erros novos.

- [ ] **Step 4: Revisão final da fatia + commit de eventuais correções.**
