# Badges, telefone, duplicados, duplicar card e "+ Contactos" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar todos os tipos de contacto no card do Kanban, formatar telefones de forma legível (leitura e escrita), detetar e permitir juntar contactos duplicados, permitir duplicar um card na pipeline, e trazer de volta um botão "+ Contactos" para adicionar contactos já existentes.

**Architecture:** Zero migrações para a maior parte — só a função SQL de juntar contactos (`merge_people`) precisa de uma migration nova, aplicada diretamente ao projeto Supabase partilhado (`sxenhpowxhexcggkepen`) via MCP `apply_migration`, seguindo o padrão já usado nas specs anteriores. A deteção de duplicados é feita no browser (agrupamento client-side sobre `GET /api/people`, que já devolve tudo o que é preciso) — mais simples do que um endpoint dedicado, e consistente com o padrão já usado em `app/(app)/people/page.tsx` (filtragem client-side sobre a lista completa). O "+ Contactos" reaproveita o `ContactPickerModal.tsx` que existia antes de ser removido (recuperado do histórico do git, commit `a181e4d~1`), e um endpoint em lote novo (`add-contacts`) que segue exatamente a estrutura do `add-properties` já existente.

**Tech Stack:** Next.js 16 (rotas com `params: Promise<...>`), React 19, Supabase (Postgres + RLS). **Sem framework de testes** — verificação é `npx tsc --noEmit` + `npm run build` + preview manual. Continuar no branch `claude/pipeline-lead-contact-forms-1699c3` (mesmo branch das correções anteriores desta sessão).

**Spec:** `docs/superpowers/specs/2026-07-26-pipeline-duplicados-telefone-design.md`

---

## Mapa de ficheiros

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `components/pipeline/KanbanBoard.tsx` | Modificar | Todos os tipos no card (A) + botão duplicar card (D) |
| `lib/whatsapp/utils.ts` | Modificar | Nova função `formatPhoneDisplay` (B) |
| `app/(app)/people/page.tsx` | Modificar | Aplicar `formatPhoneDisplay` na leitura (B) |
| `components/contacts/ContactDetailPanel.tsx` | Modificar | `formatPhoneDisplay` na leitura + `onBlur` na edição (B, C) |
| `app/(app)/leads/[id]/page.tsx` | Modificar | `formatPhoneDisplay` na leitura (B) |
| `components/leads/LinkContactModal.tsx` | Modificar | `formatPhoneDisplay` na leitura (B) |
| `components/contacts/NewContactModal.tsx` | Modificar | `onBlur` no campo telefone (B) |
| `components/leads/NewLeadModal.tsx` | Modificar | `onBlur` no campo telefone (B) |
| `app/(app)/people/duplicates/page.tsx` | Criar | Página de duplicados + ação de juntar (C) |
| `app/api/people/merge/route.ts` | Criar | Endpoint que chama a função SQL de juntar (C) |
| `supabase/migrations/20260726120000_merge_people_function.sql` | Criar | Função `merge_people` (C) |
| `components/pipeline/ContactPickerModal.tsx` | Criar (recuperar) | Picker de contactos existentes, A-Z + pesquisa por nome/telefone (E) |
| `app/api/pipelines/[id]/add-contacts/route.ts` | Criar | Endpoint em lote para "+ Contactos" (E) |
| `components/pipeline/PipelineBoard.tsx` | Modificar | Novo botão "+ Contactos" (E) |

## Factos do código (verificados — não re-descobrir)

- `components/contacts/ContactTypeChips.tsx` já existe, recebe `{ types, size }` e renderiza um chip por tipo — é o componente a reutilizar na Task 1, não é preciso criar nada de novo.
- `lib/whatsapp/utils.ts` já tem `normalizePhone(phone)`, que devolve dígitos sem `+` (ex: `351912345678`), e `buildWaLink`.
- Tabelas com FK para `people.id` confirmadas na base de dados viva (`sxenhpowxhexcggkepen`, via `information_schema`, não os ficheiros de migration que estão incompletos): `activities.person_id` (SET NULL), `contact_interactions.person_id` (CASCADE), `lead_preferences.person_id` (SET NULL a nível de dados, mas **UNIQUE**), `leads.person_id` (SET NULL), `properties.seller_id`/`properties.buyer_id` (SET NULL), `property_consultants.person_id` (**UNIQUE (property_id, person_id)**), `property_visits.person_id` (SET NULL).
- `GET /api/people` (`app/api/people/route.ts`) já devolve `*, leads(id, name, stage_id, deal_value, pipeline_stages(name, color))` — chega para calcular duplicados e nº de negócios no browser, sem precisar de endpoint novo de listagem.
- `app/api/pipelines/[id]/add-properties/route.ts` é o padrão exato a seguir para o novo `add-contacts`: mesma agência, 1ª etapa por posição, bloqueio de duplicados por leads ativas (`is_won=false, is_lost=false`).
- `app/api/people/[id]/pipeline/route.ts` (POST) já tem a lógica de extrair `zone`/`typology` de `details.search_zone`/`details.selling_zone`/`details.typology` de uma pessoa — reaproveitada no `add-contacts`.
- `PipelineBoard.tsx` carrega `leads` via `GET /api/leads?pipeline_id=`, que já inclui `pipeline_stages(..., is_won, is_lost)` e `person_id` — dá para calcular `alreadyInIds` sem pedido extra.
- `.icon-btn` já existe em `app/globals.css:558-571` (30×30px, hover com `background: var(--card-hover)`) — reutilizado para o botão de duplicar card, sem CSS novo.
- O `ContactPickerModal.tsx` original (antes de removido no commit `a181e4d`) está disponível via `git show a181e4d~1:components/pipeline/ContactPickerModal.tsx`.

---

### Task 1: Todos os tipos no card do Kanban

**Files:**
- Modify: `components/pipeline/KanbanBoard.tsx`

- [ ] **Step 1: Importar `ContactTypeChips` e trocar o badge único**

No topo do ficheiro, a seguir a `import { contactTypeMeta } from '@/lib/contacts/constants'`, adicionar:

```tsx
import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'
```

Na função `LeadCard`, remover a linha:

```tsx
  const typeMeta = lead.people?.types?.length ? contactTypeMeta(lead.people.types[0]) : null
```

E o bloco JSX que a usa:

```tsx
          {typeMeta && (
            <span title={typeMeta.label} style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: `${typeMeta.color}18`, color: typeMeta.color, border: `1px solid ${typeMeta.color}40`, flexShrink: 0 }}>
              {typeMeta.label.split(' ')[0]}
            </span>
          )}
```

por:

```tsx
          {lead.people?.types && lead.people.types.length > 0 && (
            <ContactTypeChips types={lead.people.types} size={8} />
          )}
```

`contactTypeMeta` deixa de ser usado neste ficheiro depois desta troca — remove também o import (`import { contactTypeMeta } from '@/lib/contacts/constants'`) se não sobrar mais nenhuma chamada a ele no ficheiro (confirma com `grep -n "contactTypeMeta" components/pipeline/KanbanBoard.tsx` antes de remover).

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/KanbanBoard.tsx
git commit -m "feat: show all contact type badges on pipeline card"
```

---

### Task 2: Formatação do telefone — leitura

**Files:**
- Modify: `lib/whatsapp/utils.ts`
- Modify: `app/(app)/people/page.tsx`
- Modify: `components/contacts/ContactDetailPanel.tsx`
- Modify: `app/(app)/leads/[id]/page.tsx`
- Modify: `components/leads/LinkContactModal.tsx`

- [ ] **Step 1: Adicionar `formatPhoneDisplay` a `lib/whatsapp/utils.ts`**

Adicionar ao fim do ficheiro:

```ts
// Formata para leitura: "+351 987233111". Números que normalizam para mais
// de 9 dígitos assumem que os dígitos a mais no início são o indicativo;
// sem indicativo reconhecível (9 dígitos ou menos, ou não numérico),
// devolve o valor original tal como foi guardado.
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone)
  if (!/^\d+$/.test(normalized)) return phone
  if (normalized.length > 9) {
    const country = normalized.slice(0, normalized.length - 9)
    const rest = normalized.slice(-9)
    return `+${country} ${rest}`
  }
  return phone
}
```

- [ ] **Step 2: Aplicar em `app/(app)/people/page.tsx`**

No topo do ficheiro, a seguir a `import { buildWaLink } from '@/lib/whatsapp/utils'`, trocar por:

```tsx
import { buildWaLink, formatPhoneDisplay } from '@/lib/whatsapp/utils'
```

Nas 3 linhas de `PreviewLine`/fallback que mostram o telefone como texto:

```tsx
        {(p.email || p.phone) && <>{dot}{p.email ?? p.phone}</>}
```

(aparece duas vezes, nos blocos `consultor` e `servico`) e:

```tsx
  return <div style={dim}>{p.email ?? p.phone ?? '—'}</div>
```

trocar `p.phone` por `(p.phone ? formatPhoneDisplay(p.phone) : p.phone)` em cada uma — ou seja:

```tsx
        {(p.email || p.phone) && <>{dot}{p.email ?? (p.phone ? formatPhoneDisplay(p.phone) : p.phone)}</>}
```

e

```tsx
  return <div style={dim}>{p.email ?? (p.phone ? formatPhoneDisplay(p.phone) : p.phone) ?? '—'}</div>
```

Não tocar nas linhas 65 do bloco principal do topo do ficheiro que mostram só email (verificar qual delas é a genérica vs a de consultor/serviço antes de editar, lendo o ficheiro).

Os links `href={`tel:${p.phone}`}` e `href={buildWaLink(p.phone, ...)}` **não mudam** — continuam a usar `p.phone` em bruto, porque `tel:`/`wa.me` não devem ter espaços/`+` inconsistentes.

- [ ] **Step 3: Aplicar em `components/contacts/ContactDetailPanel.tsx`**

No topo, a seguir aos imports de `@/lib/contacts/constants`, adicionar:

```tsx
import { formatPhoneDisplay } from '@/lib/whatsapp/utils'
```

Trocar:

```tsx
                {field('Telefone',
                  fieldValue(person.phone),
                  <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                )}
```

por (só a parte de visualização muda; o `<input>` de edição fica igual por agora, a formatação `onBlur` entra na Task 3):

```tsx
                {field('Telefone',
                  fieldValue(person.phone ? formatPhoneDisplay(person.phone) : person.phone),
                  <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                )}
```

- [ ] **Step 4: Aplicar em `app/(app)/leads/[id]/page.tsx`**

No topo, adicionar `import { formatPhoneDisplay } from '@/lib/whatsapp/utils'`.

Trocar:

```tsx
            { icon: '📞', label: 'Telefone', value: lead.phone },
```

por:

```tsx
            { icon: '📞', label: 'Telefone', value: lead.phone ? formatPhoneDisplay(lead.phone) : lead.phone },
```

- [ ] **Step 5: Aplicar em `components/leads/LinkContactModal.tsx`**

No topo, adicionar `import { formatPhoneDisplay } from '@/lib/whatsapp/utils'`.

Trocar:

```tsx
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.email ?? p.phone ?? ''}</div>
```

por:

```tsx
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.email ?? (p.phone ? formatPhoneDisplay(p.phone) : p.phone) ?? ''}</div>
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add lib/whatsapp/utils.ts "app/(app)/people/page.tsx" components/contacts/ContactDetailPanel.tsx "app/(app)/leads/[id]/page.tsx" components/leads/LinkContactModal.tsx
git commit -m "feat: format phone numbers with separated country code on display"
```

---

### Task 3: Formatação do telefone — escrita (onBlur)

**Files:**
- Modify: `components/contacts/NewContactModal.tsx`
- Modify: `components/leads/NewLeadModal.tsx`
- Modify: `components/contacts/ContactDetailPanel.tsx`

- [ ] **Step 1: `NewContactModal.tsx`**

No topo, trocar o import de `normalizePhone` (já existe, `import { normalizePhone } from '@/lib/whatsapp/utils'`) por:

```tsx
import { normalizePhone, formatPhoneDisplay } from '@/lib/whatsapp/utils'
```

Trocar:

```tsx
          <input className="input" placeholder="Telefone" value={phone} onChange={e => setPhone(e.target.value)} />
```

por:

```tsx
          <input className="input" placeholder="Telefone" value={phone} onChange={e => setPhone(e.target.value)} onBlur={() => setPhone(p => p.trim() ? formatPhoneDisplay(p) : p)} />
```

- [ ] **Step 2: `NewLeadModal.tsx`**

No topo, trocar o import de `normalizePhone` por:

```tsx
import { normalizePhone, formatPhoneDisplay } from '@/lib/whatsapp/utils'
```

Trocar:

```tsx
            <div><label style={labelStyle}>Telefone</label><input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
```

por:

```tsx
            <div><label style={labelStyle}>Telefone</label><input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} onBlur={() => setForm(p => ({ ...p, phone: p.phone.trim() ? formatPhoneDisplay(p.phone) : p.phone }))} /></div>
```

- [ ] **Step 3: `ContactDetailPanel.tsx`**

Trocar o `<input>` de telefone em modo edição (já editado na Task 2, sem `onBlur` ainda):

```tsx
                  <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
```

por:

```tsx
                  <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} onBlur={() => setForm(p => ({ ...p, phone: p.phone.trim() ? formatPhoneDisplay(p.phone) : p.phone }))} />
```

(O import de `formatPhoneDisplay` já foi adicionado na Task 2, não repetir.)

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add components/contacts/NewContactModal.tsx components/leads/NewLeadModal.tsx components/contacts/ContactDetailPanel.tsx
git commit -m "feat: auto-format phone number on blur in edit forms"
```

---

### Task 4: Deteção de duplicados

**Files:**
- Create: `app/(app)/people/duplicates/page.tsx`
- Modify: `app/(app)/people/page.tsx`

- [ ] **Step 1: Criar a página de duplicados**

Conteúdo completo de `app/(app)/people/duplicates/page.tsx`:

```tsx
'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import type { Person } from '@/types'
import { normalizePhone, formatPhoneDisplay } from '@/lib/whatsapp/utils'

type PersonWithLeads = Person & { leads?: { id: string }[] }
type DuplicateGroup = { phone: string; people: PersonWithLeads[] }

export default function DuplicatesPage() {
  const [people, setPeople] = useState<PersonWithLeads[]>([])
  const [loading, setLoading] = useState(true)
  const [mergingPhone, setMergingPhone] = useState<string | null>(null)

  const fetchPeople = useCallback(async () => {
    const res = await fetch('/api/people')
    setPeople(res.ok ? await res.json() : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPeople() }, [fetchPeople])

  const groups = useMemo<DuplicateGroup[]>(() => {
    const byPhone = new Map<string, PersonWithLeads[]>()
    for (const p of people) {
      if (!p.phone) continue
      const key = normalizePhone(p.phone)
      if (!key) continue
      const list = byPhone.get(key) ?? []
      list.push(p)
      byPhone.set(key, list)
    }
    return [...byPhone.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([phone, list]) => ({ phone, people: list }))
  }, [people])

  async function keepThis(group: DuplicateGroup, primaryId: string) {
    setMergingPhone(group.phone)
    try {
      for (const p of group.people) {
        if (p.id === primaryId) continue
        await fetch('/api/people/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ primary_id: primaryId, duplicate_id: p.id }),
        })
      }
      await fetchPeople()
    } finally {
      setMergingPhone(null)
    }
  }

  return (
    <div className="page-enter">
      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20 }}>Contactos duplicados</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{groups.length} grupo(s) com o mesmo telefone</p>
        </div>
        <Link href="/people" className="btn btn-ghost">← Contactos</Link>
      </div>

      <div className="page-pad" style={{ padding: '20px 32px' }}>
        {loading ? (
          <div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>A carregar…</div>
        ) : groups.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Sem duplicados detetados.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {groups.map(group => (
              <div key={group.phone} className="card" style={{ padding: 18 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{formatPhoneDisplay(group.phone)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${group.people.length}, 1fr)`, gap: 12 }}>
                  {group.people.map(p => (
                    <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.email ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Criado em {new Date(p.created_at).toLocaleDateString('pt-PT')}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.leads?.length ?? 0} negócio(s)</div>
                      <Link href={`/people/${p.id}`} style={{ fontSize: 11, color: 'var(--gold)' }}>Ver ficha →</Link>
                      <button
                        onClick={() => keepThis(group, p.id)}
                        disabled={mergingPhone === group.phone}
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 6 }}
                      >
                        {mergingPhone === group.phone ? 'A juntar…' : 'Manter este'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Link a partir de `/people`**

Em `app/(app)/people/page.tsx`, no cabeçalho da página (perto do `<h1 className="font-display">Contactos ...`), adicionar um link condicional. Primeiro, calcular a contagem de duplicados no componente `PeoplePage` — a seguir à declaração de `visible` (`useMemo`), adicionar:

```tsx
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
```

Isto usa `normalizePhone` — a mesma função usada na página `/people/duplicates` (Step 1) — para que a contagem no cabeçalho e os grupos mostrados na página batam sempre certo. Adiciona o import no topo de `app/(app)/people/page.tsx`, junto ao já existente `import { buildWaLink, formatPhoneDisplay } from '@/lib/whatsapp/utils'` (Task 2, Step 2):

```tsx
import { buildWaLink, formatPhoneDisplay, normalizePhone } from '@/lib/whatsapp/utils'
```

Depois, no bloco do cabeçalho onde está o `<p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{visible.length} contactos</p>`, adicionar logo a seguir (mesmo `<div>` pai):

```tsx
          {duplicateCount > 0 && (
            <a href="/people/duplicates" style={{ fontSize: 12, color: '#B45309', fontWeight: 600, textDecoration: 'none' }}>⚠ {duplicateCount} duplicado(s)</a>
          )}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/people/duplicates/page.tsx" "app/(app)/people/page.tsx"
git commit -m "feat: detect and list contacts sharing the same phone number"
```

---

### Task 5: Função de juntar contactos (merge)

**Files:**
- Create: `supabase/migrations/20260726120000_merge_people_function.sql`
- Create: `app/api/people/merge/route.ts`

- [ ] **Step 1: Escrever a migration**

Conteúdo completo de `supabase/migrations/20260726120000_merge_people_function.sql`:

```sql
-- Junta dois contactos duplicados: move para o principal (p_primary_id)
-- tudo o que estava ligado ao duplicado (p_duplicate_id), resolvendo os
-- conflitos de unicidade conhecidos (lead_preferences.person_id é UNIQUE;
-- property_consultants tem UNIQUE (property_id, person_id)), preenche
-- campos vazios do principal a partir do duplicado, junta as notas dos
-- dois, e apaga o duplicado no fim.
create or replace function public.merge_people(p_primary_id uuid, p_duplicate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.activities set person_id = p_primary_id where person_id = p_duplicate_id;
  update public.contact_interactions set person_id = p_primary_id where person_id = p_duplicate_id;
  update public.leads set person_id = p_primary_id where person_id = p_duplicate_id;
  update public.properties set seller_id = p_primary_id where seller_id = p_duplicate_id;
  update public.properties set buyer_id = p_primary_id where buyer_id = p_duplicate_id;
  update public.property_visits set person_id = p_primary_id where person_id = p_duplicate_id;

  delete from public.property_consultants pc_dup
    using public.property_consultants pc_primary
    where pc_dup.person_id = p_duplicate_id
      and pc_primary.person_id = p_primary_id
      and pc_primary.property_id = pc_dup.property_id;
  update public.property_consultants set person_id = p_primary_id where person_id = p_duplicate_id;

  delete from public.lead_preferences
    where person_id = p_duplicate_id
      and exists (select 1 from public.lead_preferences where person_id = p_primary_id);
  update public.lead_preferences set person_id = p_primary_id where person_id = p_duplicate_id;

  update public.people primary_row set
    email = coalesce(primary_row.email, dup.email),
    phone = coalesce(primary_row.phone, dup.phone),
    address = coalesce(primary_row.address, dup.address),
    notes = case
      when primary_row.notes is null or primary_row.notes = '' then dup.notes
      when dup.notes is null or dup.notes = '' then primary_row.notes
      else primary_row.notes || E'\n\n---\n' || dup.notes
    end
  from public.people dup
  where primary_row.id = p_primary_id and dup.id = p_duplicate_id;

  delete from public.people where id = p_duplicate_id;
end;
$$;
```

- [ ] **Step 2: Aplicar a migration ao projeto Supabase**

Usa a tool MCP `mcp__815f2f4b-6ae5-4702-9098-ffa5c7ad7442__apply_migration` com `project_id: "sxenhpowxhexcggkepen"`, `name: "merge_people_function"`, e o conteúdo SQL acima. Confirma com `mcp__815f2f4b-6ae5-4702-9098-ffa5c7ad7442__list_migrations` (mesmo `project_id`) que a migration aparece na lista antes de continuar.

- [ ] **Step 3: Criar o endpoint**

Conteúdo completo de `app/api/people/merge/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

  const body = await request.json().catch(() => ({}))
  const primaryId = typeof body.primary_id === 'string' ? body.primary_id : null
  const duplicateId = typeof body.duplicate_id === 'string' ? body.duplicate_id : null
  if (!primaryId || !duplicateId || primaryId === duplicateId) {
    return NextResponse.json({ error: 'primary_id e duplicate_id são obrigatórios e têm de ser diferentes' }, { status: 400 })
  }

  const { data: both } = await supabase
    .from('people')
    .select('id')
    .eq('agency_id', profile.agency_id)
    .in('id', [primaryId, duplicateId])
  if (!both || both.length !== 2) {
    return NextResponse.json({ error: 'Contactos não encontrados nesta agência' }, { status: 404 })
  }

  const { error } = await supabase.rpc('merge_people', { p_primary_id: primaryId, p_duplicate_id: duplicateId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260726120000_merge_people_function.sql app/api/people/merge/route.ts
git commit -m "feat: add contact merge function and endpoint"
```

---

### Task 6: Duplicar card na pipeline

**Files:**
- Modify: `components/pipeline/KanbanBoard.tsx`

- [ ] **Step 1: Adicionar o botão de duplicar ao `LeadCard`**

Na assinatura de `LeadCard`, adicionar um novo prop opcional `onDuplicated`:

```tsx
function LeadCard({ lead, isDragging, onOpenContact, cardFields, onDuplicated }: { lead: Lead; isDragging?: boolean; onOpenContact?: (personId: string, leadId: string) => void; cardFields: PipelineCardFields; onDuplicated?: () => void }) {
```

Dentro da função, antes do `return`, adicionar:

```tsx
  const [duplicating, setDuplicating] = useState(false)

  async function duplicateCard(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Duplicar este card? Cria uma nova entrada para o mesmo contacto, sem imóvel associado.')) return
    setDuplicating(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          zone: lead.zone,
          typology: lead.typology,
          budget: lead.budget,
          notes: lead.notes,
          person_id: lead.person_id,
          organization_id: lead.organization_id,
          property_id: null,
          pipeline_id: lead.pipeline_id,
          stage_id: lead.stage_id,
        }),
      })
      if (res.ok) onDuplicated?.()
    } finally {
      setDuplicating(false)
    }
  }
```

No topo do ficheiro, `useState` já está importado (linha 2: `import { useState, useEffect } from 'react'`) — não precisa de mudança de imports.

Na linha do cabeçalho do card (`<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>`), a seguir ao bloco de `ContactTypeChips` (Task 1) e antes do fecho desse `<div>`, adicionar:

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

- [ ] **Step 2: Encaminhar `onDuplicated` de `KanbanBoard` para `LeadCard`**

Na assinatura de `KanbanBoard`, adicionar `onDuplicated?: () => void` a `Props` e passá-lo:

```tsx
type Props = {
  initialLeads: Lead[]
  stages: PipelineStage[]
  onOpenContact?: (personId: string, leadId: string) => void
  cardFields: PipelineCardFields
  onDuplicated?: () => void
}

export function KanbanBoard({ initialLeads, stages, onOpenContact, cardFields, onDuplicated }: Props) {
```

Nas duas chamadas a `<LeadCard ... />` dentro de `KanbanBoard` (uma no `map` das colunas, outra no `DragOverlay`), acrescentar `onDuplicated={onDuplicated}`.

- [ ] **Step 3: `PipelineBoard.tsx` passa `onDuplicated`**

Na chamada a `<KanbanBoard ... />`, acrescentar:

```tsx
            onDuplicated={() => selectedId && loadBoard(selectedId)}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add components/pipeline/KanbanBoard.tsx components/pipeline/PipelineBoard.tsx
git commit -m "feat: allow duplicating a pipeline card for a second property"
```

---

### Task 7: "+ Contactos" na pipeline

**Files:**
- Create: `components/pipeline/ContactPickerModal.tsx`
- Create: `app/api/pipelines/[id]/add-contacts/route.ts`
- Modify: `components/pipeline/PipelineBoard.tsx`

- [ ] **Step 1: Criar `ContactPickerModal.tsx`**

Conteúdo completo:

```tsx
'use client'
import { useState, useEffect, useMemo } from 'react'
import type { Person } from '@/types'

// Popup: lista de contactos A-Z, pesquisa por nome ou telefone, checkbox
// por linha. Os contactos já ativos nesta pipeline aparecem marcados e
// desativados (para os duplicar, usa-se o botão "Duplicar" no card, não
// este picker).
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
      (digits && (p.phone ?? '').replace(/\D/g, '').includes(digits))
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

  async function confirm() {
    if (checked.size === 0) { onClose(); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/add-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_ids: [...checked] }),
      })
      if (res.ok) { onAdded(); onClose() }
    } finally {
      setSaving(false)
    }
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
            {saving ? 'A adicionar…' : `Adicionar${checked.size > 0 ? ` (${checked.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar o endpoint `add-contacts`**

Conteúdo completo de `app/api/pipelines/[id]/add-contacts/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Adiciona vários contactos já existentes a esta pipeline de uma vez: cria
// uma lead por pessoa na 1ª etapa, sem imóvel associado. Bloqueia
// duplicados por combinação (person_id, pipeline_id) com lead ativa —
// mesma regra do POST /api/people/[id]/pipeline (um único contacto de
// cada vez), aplicada aqui em lote.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: pipelineId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const personIds: string[] = Array.isArray(body.person_ids)
    ? body.person_ids.filter((v: unknown): v is string => typeof v === 'string')
    : []
  if (personIds.length === 0) return NextResponse.json({ added: 0 })

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('id', pipelineId)
    .eq('agency_id', profile.agency_id)
    .single()
  if (!pipeline) return NextResponse.json({ error: 'Pipeline inválida' }, { status: 404 })

  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!firstStage) return NextResponse.json({ error: 'A pipeline não tem etapas. Cria uma etapa primeiro.' }, { status: 400 })

  const { data: existing } = await supabase
    .from('leads')
    .select('person_id, pipeline_stages!inner(is_won, is_lost)')
    .eq('pipeline_id', pipelineId)
    .eq('agency_id', profile.agency_id)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)
    .in('person_id', personIds)
  const existingIds = new Set((existing ?? []).map(l => l.person_id))

  const toAdd = personIds.filter(id => !existingIds.has(id))
  if (toAdd.length === 0) return NextResponse.json({ added: 0 })

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

  const { error } = await supabase.from('leads').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ added: rows.length })
}
```

- [ ] **Step 3: Ligar o botão em `PipelineBoard.tsx`**

No topo, adicionar o import:

```tsx
import { ContactPickerModal } from '@/components/pipeline/ContactPickerModal'
```

Adicionar um novo estado, a seguir a `const [showPicker, setShowPicker] = useState(false)`:

```tsx
  const [showContactPicker, setShowContactPicker] = useState(false)
```

Calcular `alreadyInIds` a partir de `leads` (leads ativas com `person_id`), antes do `return`:

```tsx
  const alreadyInIds = new Set(
    leads.filter(l => l.person_id && l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost)
      .map(l => l.person_id as string)
  )
```

Adicionar a renderização do modal, a seguir ao bloco `{showPicker && selected && (<PropertyPickerModal .../>)}`:

```tsx
      {showContactPicker && selected && (
        <ContactPickerModal
          pipelineId={selected.id}
          pipelineName={selected.name}
          alreadyInIds={alreadyInIds}
          onClose={() => setShowContactPicker(false)}
          onAdded={() => selectedId && loadBoard(selectedId)}
        />
      )}
```

Trocar a linha dos botões:

```tsx
          <button onClick={() => setShowPicker(true)} disabled={!selected} className="btn btn-ghost">+ Imóveis</button>
          <button onClick={() => setShowNewLead(true)} disabled={!selectedId} className="btn btn-primary">+ Novo Lead</button>
```

por:

```tsx
          <button onClick={() => setShowContactPicker(true)} disabled={!selected} className="btn btn-ghost">+ Contactos</button>
          <button onClick={() => setShowPicker(true)} disabled={!selected} className="btn btn-ghost">+ Imóveis</button>
          <button onClick={() => setShowNewLead(true)} disabled={!selectedId} className="btn btn-primary">+ Novo Lead</button>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add components/pipeline/ContactPickerModal.tsx "app/api/pipelines/[id]/add-contacts/route.ts" components/pipeline/PipelineBoard.tsx
git commit -m "feat: restore + Contactos button to add existing contacts to a pipeline"
```

---

### Task 8: Verificação final

- [ ] **Step 1: Type check completo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build completa sem erros.

- [ ] **Step 3: Lint sobre os ficheiros tocados nesta plano**

Run:
```bash
npx eslint components/pipeline/KanbanBoard.tsx components/pipeline/PipelineBoard.tsx components/pipeline/ContactPickerModal.tsx lib/whatsapp/utils.ts "app/(app)/people/page.tsx" "app/(app)/people/duplicates/page.tsx" components/contacts/ContactDetailPanel.tsx components/contacts/NewContactModal.tsx components/leads/NewLeadModal.tsx components/leads/LinkContactModal.tsx "app/(app)/leads/[id]/page.tsx" "app/api/pipelines/[id]/add-contacts/route.ts" app/api/people/merge/route.ts
```
Expected: nenhum erro/aviso novo introduzido por este plano (compara com o estado da branch antes deste plano, que já tinha alguns avisos pré-existentes documentados na sessão anterior — só interessa não adicionar novos).

- [ ] **Step 4: Revisão holística**

Dispatch de um review final (subagent `superpowers:code-reviewer`) comparando o diff completo desde o commit anterior ao Task 1 até ao HEAD contra a spec `docs/superpowers/specs/2026-07-26-pipeline-duplicados-telefone-design.md`, à procura de interações entre tasks (ex: o botão "Duplicar" do card (Task 6) cria uma lead sem `custom_fields`/`deal_value` — confirmar que isso é aceitável e não quebra nada na página `/leads/[id]` ao abrir esse card depois).
