# Cards de Pipeline Configuráveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada pipeline define que campo aparece em grande e em pequeno nos cards do kanban (Nome/Zona/Imóvel/Tipologia/Valor), configurável num mini-modal ao criar/editar a pipeline.

**Architecture:** Duas colunas novas em `pipelines` (`card_primary_field`/`card_secondary_field`, com seed zona/nome para "Vendedores"). Um `PipelineSettingsModal` substitui os `prompt()` de criar/renomear no board. O `LeadCard` resolve o valor de cada campo com um helper puro e deduplica as linhas fixas.

**Tech Stack:** Next.js 16, React 19, Supabase (migração SQL aplicada pelo coordenador via MCP — o subagente só cria o ficheiro). **Sem framework de testes** — verificação é `npx tsc --noEmit` + preview. Branch: criar `claude/cards-configuraveis` a partir de `claude/pesquisa-zona-investidor`.

**Spec:** `docs/superpowers/specs/2026-07-18-cards-configuraveis-pipeline-design.md`

---

## Mapa de ficheiros

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260718_pipeline_card_fields.sql` | Criar | Colunas + seed Vendedores |
| `types/index.ts` | Modificar | `PipelineCardField` + campos no tipo `Pipeline` |
| `app/api/pipelines/route.ts` | Modificar | POST aceita/valida os campos |
| `app/api/pipelines/[id]/route.ts` | Modificar | PATCH aceita/valida os campos |
| `components/pipeline/PipelineSettingsModal.tsx` | Criar | Modal nome + 2 selects (criar/editar) |
| `components/pipeline/PipelineBoard.tsx` | Modificar | Usa o modal; remove prompts; passa cardFields |
| `components/pipeline/KanbanBoard.tsx` | Modificar | LeadCard renderiza primário/secundário + dedupe |

---

### Task 1: Migração, tipos e APIs

**Files:**
- Create: `supabase/migrations/20260718_pipeline_card_fields.sql`
- Modify: `types/index.ts`
- Modify: `app/api/pipelines/route.ts`
- Modify: `app/api/pipelines/[id]/route.ts`

- [ ] **Step 0: Criar o branch**

```bash
git checkout -b claude/cards-configuraveis
```
(Se já existir e estiver ativo, seguir em frente.)

- [ ] **Step 1: Ficheiro de migração**

Conteúdo completo de `supabase/migrations/20260718_pipeline_card_fields.sql`:

```sql
-- Campos configuráveis do card do kanban, por pipeline: qual a informação
-- principal (em grande) e secundária (em pequeno) de cada card.
alter table public.pipelines
  add column card_primary_field   text not null default 'name'
    check (card_primary_field in ('name','zone','property','typology','value')),
  add column card_secondary_field text not null default 'zone'
    check (card_secondary_field in ('name','zone','property','typology','value'));

-- Vendedores: o pedido original do cliente — zona em grande, nome em pequeno
update public.pipelines
  set card_primary_field = 'zone', card_secondary_field = 'name'
  where name = 'Vendedores';
```

**Não aplicar a migração** — o coordenador aplica-a ao Supabase via MCP antes da verificação final. Só criar o ficheiro.

- [ ] **Step 2: Tipos**

Em `types/index.ts`, antes do tipo `Pipeline`, acrescentar:

```ts
export type PipelineCardField = 'name' | 'zone' | 'property' | 'typology' | 'value'
```

E no tipo `Pipeline` (após `position: number`):

```ts
  card_primary_field: PipelineCardField
  card_secondary_field: PipelineCardField
```

- [ ] **Step 3: POST /api/pipelines aceita os campos**

Em `app/api/pipelines/route.ts`, no topo do ficheiro (após imports):

```ts
const CARD_FIELDS = ['name', 'zone', 'property', 'typology', 'value'] as const
function parseCardField(v: unknown): string | undefined {
  return typeof v === 'string' && (CARD_FIELDS as readonly string[]).includes(v) ? v : undefined
}
```

No POST, o insert atual:

```ts
  const { data, error } = await supabase
    .from('pipelines')
    .insert({ agency_id: profile.agency_id, name, position })
```

passa a:

```ts
  const cardPrimary = parseCardField(body.card_primary_field)
  const cardSecondary = parseCardField(body.card_secondary_field)
  if (cardPrimary && cardSecondary && cardPrimary === cardSecondary) {
    return NextResponse.json({ error: 'Info principal e secundária não podem ser iguais' }, { status: 400 })
  }
  const insert: Record<string, unknown> = { agency_id: profile.agency_id, name, position }
  if (cardPrimary) insert.card_primary_field = cardPrimary
  if (cardSecondary) insert.card_secondary_field = cardSecondary

  const { data, error } = await supabase
    .from('pipelines')
    .insert(insert)
```

- [ ] **Step 4: PATCH /api/pipelines/[id] aceita os campos**

Em `app/api/pipelines/[id]/route.ts`, replicar o helper no topo (após imports — ficheiro diferente, duplicação de 5 linhas aceitável):

```ts
const CARD_FIELDS = ['name', 'zone', 'property', 'typology', 'value'] as const
function parseCardField(v: unknown): string | undefined {
  return typeof v === 'string' && (CARD_FIELDS as readonly string[]).includes(v) ? v : undefined
}
```

No PATCH, depois das linhas que preenchem `update` com `name`/`position`, acrescentar:

```ts
  const cardPrimary = parseCardField(body.card_primary_field)
  const cardSecondary = parseCardField(body.card_secondary_field)
  if (cardPrimary && cardSecondary && cardPrimary === cardSecondary) {
    return NextResponse.json({ error: 'Info principal e secundária não podem ser iguais' }, { status: 400 })
  }
  if (cardPrimary) update.card_primary_field = cardPrimary
  if (cardSecondary) update.card_secondary_field = cardSecondary
```

(A validação de igualdade só corre quando ambos vêm no pedido — o modal envia sempre os dois, e a UI já impede iguais; isto é a rede de segurança.)

- [ ] **Step 5: Type-check e commit**

```bash
npx tsc --noEmit
git add supabase/migrations/20260718_pipeline_card_fields.sql types/index.ts app/api/pipelines/route.ts "app/api/pipelines/[id]/route.ts"
git commit -m "feat: campos de card configuráveis por pipeline (BD + APIs)"
```

Nota: o `tsc` passa mesmo sem a migração aplicada — o tipo `Pipeline` ganha os campos, e os consumidores existentes não os leem ainda. O `PipelineBoard` só os usa na Task 3.

---

### Task 2: `PipelineSettingsModal` + wiring no board

**Files:**
- Create: `components/pipeline/PipelineSettingsModal.tsx`
- Modify: `components/pipeline/PipelineBoard.tsx`

- [ ] **Step 1: Criar o modal**

Conteúdo completo de `components/pipeline/PipelineSettingsModal.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Pipeline, PipelineCardField } from '@/types'

const CARD_FIELDS: { key: PipelineCardField; label: string }[] = [
  { key: 'name', label: 'Nome' },
  { key: 'zone', label: 'Zona' },
  { key: 'property', label: 'Imóvel' },
  { key: 'typology', label: 'Tipologia' },
  { key: 'value', label: 'Valor' },
]

type Props = {
  pipeline?: Pipeline | null // null/undefined = criar nova
  onClose: () => void
  onSaved: (p: Pipeline) => void
}

// Mini-modal de criação/edição de pipeline: nome + que campo aparece em
// grande (principal) e em pequeno (secundário) nos cards do kanban.
export function PipelineSettingsModal({ pipeline, onClose, onSaved }: Props) {
  const isEdit = !!pipeline
  const [name, setName] = useState(pipeline?.name ?? '')
  const [primary, setPrimary] = useState<PipelineCardField>(pipeline?.card_primary_field ?? 'name')
  const [secondary, setSecondary] = useState<PipelineCardField>(pipeline?.card_secondary_field ?? 'zone')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A secundária nunca pode ser igual à principal
  function changePrimary(v: PipelineCardField) {
    setPrimary(v)
    if (v === secondary) setSecondary(CARD_FIELDS.find(f => f.key !== v)!.key)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(isEdit ? `/api/pipelines/${pipeline!.id}` : '/api/pipelines', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), card_primary_field: primary, card_secondary_field: secondary }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError((data as { error?: string }).error ?? 'Erro ao guardar pipeline.'); return }
      onSaved(data as Pipeline)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card" onClick={e => e.stopPropagation()} style={{ width: 'min(380px, 92vw)', padding: 24 }}>
        <div className="font-display" style={{ fontSize: 16, marginBottom: 14 }}>{isEdit ? 'Editar pipeline' : 'Nova pipeline'}</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>Nome</div>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Arrendamentos" autoFocus required />
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>Info principal do card</div>
            <select className="input" value={primary} onChange={e => changePrimary(e.target.value as PipelineCardField)}>
              {CARD_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>Info secundária</div>
            <select className="input" value={secondary} onChange={e => setSecondary(e.target.value as PipelineCardField)}>
              {CARD_FIELDS.filter(f => f.key !== primary).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          {error && <div style={{ fontSize: 12, color: '#DC2626' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
            <button type="submit" disabled={busy || !name.trim()} className="btn btn-primary">{busy ? 'A guardar…' : isEdit ? 'Guardar' : 'Criar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

(`.modal-backdrop` existe em `app/globals.css` — é o padrão dos outros modais; z-index 100 fica acima do slide-over. `section-label` também é classe existente.)

- [ ] **Step 2: `PipelineBoard` usa o modal**

Em `components/pipeline/PipelineBoard.tsx`:

1. Import:

```tsx
import { PipelineSettingsModal } from '@/components/pipeline/PipelineSettingsModal'
```

2. Novo estado junto aos outros:

```tsx
  const [pipelineModal, setPipelineModal] = useState<{ mode: 'create' } | { mode: 'edit'; pipeline: Pipeline } | null>(null)
```

3. **Apagar** as funções `createPipeline()` e `renamePipeline()` (os `prompt()` desaparecem; `deletePipeline()` com `confirm()` fica).

4. No JSX, junto aos outros modais:

```tsx
      {pipelineModal && (
        <PipelineSettingsModal
          pipeline={pipelineModal.mode === 'edit' ? pipelineModal.pipeline : null}
          onClose={() => setPipelineModal(null)}
          onSaved={p => {
            if (pipelineModal.mode === 'create') {
              setPipelines(prev => [...prev, p])
              setSelectedId(p.id)
            } else {
              setPipelines(prev => prev.map(x => x.id === p.id ? p : x))
            }
          }}
        />
      )}
```

5. O botão "+ Pipeline" passa de `onClick={createPipeline}` para `onClick={() => setPipelineModal({ mode: 'create' })}`.

6. O botão ✏️ passa de `onClick={() => renamePipeline(p)}` para `onClick={() => setPipelineModal({ mode: 'edit', pipeline: p })}` (title pode passar a "Editar pipeline").

- [ ] **Step 3: Type-check e commit**

```bash
npx tsc --noEmit
git add components/pipeline/PipelineSettingsModal.tsx components/pipeline/PipelineBoard.tsx
git commit -m "feat: modal de criação/edição de pipeline com campos do card"
```

---

### Task 3: `LeadCard` renderiza primário/secundário com dedupe

**Files:**
- Modify: `components/pipeline/KanbanBoard.tsx`
- Modify: `components/pipeline/PipelineBoard.tsx` (passar `cardFields`)

- [ ] **Step 1: Helper e props no `KanbanBoard`**

Em `components/pipeline/KanbanBoard.tsx`:

1. Import de tipo: acrescentar `PipelineCardField` ao import de `@/types`.

2. Antes de `LeadCard`, o helper puro e o tipo:

```tsx
export type PipelineCardFields = { primary: PipelineCardField; secondary: PipelineCardField }

// Valor de um campo configurável do card; null quando o lead não o tem.
function cardFieldValue(lead: Lead, field: PipelineCardField): string | null {
  switch (field) {
    case 'name': return lead.name
    case 'zone': return lead.zone
    case 'typology': return lead.typology
    case 'property': return lead.properties ? (lead.properties.reference ?? lead.properties.title) : null
    case 'value': {
      const v = lead.deal_value ?? lead.budget
      return v ? `${(v / 1000).toFixed(0)}K€` : null
    }
  }
}
```

3. `Props` do `KanbanBoard` e assinatura ganham `cardFields`:

```tsx
type Props = {
  initialLeads: Lead[]
  stages: PipelineStage[]
  onOpenContact?: (personId: string, leadId: string) => void
  cardFields: PipelineCardFields
}

export function KanbanBoard({ initialLeads, stages, onOpenContact, cardFields }: Props) {
```

4. `LeadCard` recebe `cardFields` e deriva, antes do `return`:

```tsx
function LeadCard({ lead, isDragging, onOpenContact, cardFields }: { lead: Lead; isDragging?: boolean; onOpenContact?: (personId: string, leadId: string) => void; cardFields: PipelineCardFields }) {
  // ... (código existente: router, sortable, initials, typeMeta)
  const primaryText = cardFieldValue(lead, cardFields.primary) ?? lead.name
  const secondaryText = cardFieldValue(lead, cardFields.secondary)
  // Campos já mostrados em cima não se repetem nas linhas fixas. Se o
  // primário caiu no fallback (nome), o nome conta como promovido na mesma.
  const promoted = new Set<PipelineCardField>([cardFields.primary, cardFields.secondary])
  if (primaryText === lead.name) promoted.add('name')
```

- [ ] **Step 2: Render do card**

Ainda em `LeadCard`, substituir o corpo do card (mantendo avatar, chip de tipo e drag intactos):

1. A linha do nome (o `<div>` grande com `fontWeight: 500, fontSize: 13`) passa a mostrar `primaryText`:

```tsx
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primaryText}</div>
```

2. Imediatamente a seguir ao fecho do flex row do avatar (depois do `</div>` da linha avatar+nome+chip), inserir a linha secundária:

```tsx
        {secondaryText && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondaryText}</div>
        )}
```

3. Linha do contacto — acrescenta a condição de não repetir o primário:

```tsx
        {lead.people?.name && lead.people.name !== lead.name && lead.people.name !== primaryText && (
          <div style={{ fontSize: 10, color: 'var(--gold)', marginBottom: 4, opacity: 0.8 }}>👤 {lead.people.name}</div>
        )}
```

4. Linha do imóvel — só quando `property` não está promovido:

```tsx
        {!promoted.has('property') && lead.properties && (
          <div style={{ fontSize: 10, color: '#10B981', marginBottom: 4, opacity: 0.8 }}>🏠 {lead.properties.reference ?? lead.properties.title}</div>
        )}
```

5. Linha tipologia·zona — omite as partes promovidas:

```tsx
        {(() => {
          const parts = [
            !promoted.has('typology') ? lead.typology : null,
            !promoted.has('zone') ? lead.zone : null,
          ].filter(Boolean)
          return parts.length > 0 ? (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{parts.join(' · ')}</div>
          ) : null
        })()}
```

6. Valor no rodapé — só quando `value` não está promovido (a data de fecho mantém-se sempre; manter o `<div />` vazio para o `justify-content: space-between` continuar a empurrar a data para a direita):

```tsx
          {!promoted.has('value') && lead.deal_value ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {(lead.deal_value / 1000).toFixed(0)}K€
            </div>
          ) : !promoted.has('value') && lead.budget ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {(lead.budget / 1000).toFixed(0)}K€
            </div>
          ) : (
            <div />
          )}
```

7. Nos DOIS sítios que renderizam `<LeadCard>` (coluna e `DragOverlay`), passar `cardFields={cardFields}`.

- [ ] **Step 3: `PipelineBoard` passa a config**

No `<KanbanBoard>` em `components/pipeline/PipelineBoard.tsx`:

```tsx
          <KanbanBoard
            key={selectedId}
            initialLeads={leads}
            stages={stages}
            onOpenContact={(personId, leadId) => setOpenContact({ personId, leadId })}
            cardFields={{ primary: selected?.card_primary_field ?? 'name', secondary: selected?.card_secondary_field ?? 'zone' }}
          />
```

(Import de `PipelineCardField` não é preciso aqui — a inferência do objeto literal chega; se o tsc reclamar, importar o tipo `PipelineCardFields` de `./KanbanBoard`.)

- [ ] **Step 4: Type-check e commit**

```bash
npx tsc --noEmit
git add components/pipeline/KanbanBoard.tsx components/pipeline/PipelineBoard.tsx
git commit -m "feat: card do kanban mostra info principal/secundária configurável"
```

---

### Task 4: Migração + verificação final

**Pelo coordenador (tem acesso MCP ao Supabase):**

- [ ] **Step 1: Aplicar a migração**

Via MCP Supabase: `apply_migration` com nome `20260718_pipeline_card_fields` e o SQL do ficheiro criado na Task 1. Confirmar depois com `execute_sql`: `select name, card_primary_field, card_secondary_field from pipelines order by position;` — "Vendedores" deve mostrar `zone`/`name`, as restantes `name`/`zone`.

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: sem erros.

- [ ] **Step 3: Preview**

1. `/pipeline` → aba "Vendedores": cards com a **zona em grande** e o nome em pequeno por baixo; sem zona repetida na linha tipologia·zona; leads sem zona mostram o nome em grande (fallback).
2. Outras abas: nome em grande (como antes), zona em pequeno.
3. ✏️ na aba ativa abre o modal pré-preenchido; mudar a principal para "Imóvel" → guardar → cards atualizam sem reload manual; repor depois.
4. "+ Pipeline" abre o modal vazio; criar pipeline de teste com principal=Valor; confirmar cards (vazios) e apagar a pipeline de teste no 🗑️.
5. Selects do modal: escolher principal igual à secundária é impossível (a secundária salta).
6. Consola sem erros novos.

**Atenção:** dados reais — não mexer em etapas/leads; a pipeline de teste criada deve ser apagada no fim.

- [ ] **Step 4: Commit final (só se a verificação obrigar a correções)**

```bash
git add -A && git commit -m "fix: ajustes da verificação (cards configuráveis)"
```
