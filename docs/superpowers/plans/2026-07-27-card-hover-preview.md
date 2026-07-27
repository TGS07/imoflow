# Pré-visualização de card em hover + dias na fase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar um "Xd" (dias nesta fase) sempre visível em cada card do Kanban, e ao passar o rato sobre um card durante ~450ms, mostrar uma versão ampliada e clicável desse card centrada no ecrã com o fundo esbatido, com texto completo (sem cortar) e telefone/email adicionais.

**Architecture:** Zero migrações e zero alterações ao backend — `leads.stage_entered_at` já existe na base de dados (reposto automaticamente por um trigger sempre que `stage_id` muda) e `GET /api/leads` já devolve todas as colunas via `select('*', ...)`. Todo o trabalho é frontend: expor o campo no tipo `Lead`, um novo componente `CardHoverPreview.tsx` para o overlay, e um pequeno gestor de hover (temporizador + supressão durante drag) dentro do `KanbanBoard` já existente, que já gere um estado semelhante (`editingProperty`) para o modal do ícone 🏠.

**Tech Stack:** Next.js 16, React 19, TypeScript. **Sem framework de testes** — verificação é `npx tsc --noEmit` + `npm run build` + `npx eslint` + leitura de código (sem sessão autenticada disponível neste ambiente para verificação manual no browser).

**Spec:** `docs/superpowers/specs/2026-07-27-card-hover-preview-design.md`

---

## Mapa de ficheiros

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `types/index.ts` | Modificar | Adiciona `stage_entered_at: string` ao tipo `Lead` |
| `components/pipeline/KanbanBoard.tsx` | Modificar | Exporta `cardFieldValue`/`daysInStage`, pill "Xd" no card normal, estado de hover (temporizador, supressão durante drag), passa handlers ao `LeadCard` |
| `components/pipeline/CardHoverPreview.tsx` | Criar | Overlay centrado no ecrã com a versão ampliada e clicável do card em hover |

## Factos do código (verificados — não re-descobrir)

- `leads.stage_entered_at` (`supabase/migrations/20260721225247_stage_notification_triggers.sql`, `20260721230836_leads_stage_entered_at_trigger.sql`, `20260721231600_leads_stage_entered_at_trigger_when.sql`) já existe, é `NOT NULL`, e é reposto para `now()` automaticamente por um trigger BD sempre que `stage_id` muda — nunca precisa de ser escrito manualmente pelo cliente.
- `GET /api/leads` (`app/api/leads/route.ts:27`) já faz `select('*', ...)` — `stage_entered_at` já vem em cada lead sem qualquer alteração à rota.
- `components/pipeline/KanbanBoard.tsx` já tem `cardFieldValue(lead, field)` (linhas 15-29, calcula o valor de um campo configurável do card) e `LeadCard` (linha 31), que já recebe `lead`, `cardFields`, `onOpenContact`, `onDuplicated`, `onEditProperty` como props.
- `KanbanBoard` já gere um estado de "item selecionado para overlay" (`editingProperty`, linha 169) com o mesmo padrão que o hover vai seguir: estado no componente pai, um novo componente para o overlay, renderizado condicionalmente no fim do `return`.
- `lib/whatsapp/utils.ts` já exporta `formatPhoneDisplay(phone)` (usado no resto da app para mostrar telefones formatados).
- `components/contacts/ContactTypeChips.tsx` já existe e aceita `{ types, size }`.
- `.card`/`var(--shadow-md)`/`var(--surface)`/`var(--border)`/`var(--muted)`/`var(--gold)` já são as variáveis/classes usadas no resto do ficheiro — reutilizadas sem CSS novo.
- `LeadCard` já é usado em dois sítios em `KanbanBoard` — dentro do `.map` das colunas (linha 254) e no `DragOverlay` (linha 263). Só o primeiro precisa dos handlers de hover; o segundo (o "fantasma" que segue o cursor durante o arraste) fica sem eles.

---

### Task 1: `stage_entered_at` no tipo `Lead` + indicador "Xd" no card

**Files:**
- Modify: `types/index.ts`
- Modify: `components/pipeline/KanbanBoard.tsx`

- [ ] **Step 1: Adicionar o campo ao tipo `Lead`**

Em `types/index.ts`, dentro de `export type Lead = { ... }`, trocar:

```ts
  is_regular: boolean
  regular_interval_days: number | null
  created_at: string
  users?: User
```

por:

```ts
  is_regular: boolean
  regular_interval_days: number | null
  created_at: string
  stage_entered_at: string
  users?: User
```

- [ ] **Step 2: Exportar `cardFieldValue` e adicionar `daysInStage`**

Em `components/pipeline/KanbanBoard.tsx`, trocar:

```tsx
// Valor de um campo configurável do card; null quando o lead não o tem.
function cardFieldValue(lead: Lead, field: PipelineCardField): string | null {
```

por:

```tsx
// Valor de um campo configurável do card; null quando o lead não o tem.
export function cardFieldValue(lead: Lead, field: PipelineCardField): string | null {
```

Logo a seguir ao fecho dessa função (depois da linha `}` que fecha `cardFieldValue`, antes de `function LeadCard`), adicionar:

```tsx
// Dias desde que o lead entrou na etapa atual. `stage_entered_at` é
// reposto automaticamente pela base de dados sempre que `stage_id` muda
// (trigger `leads_set_stage_entered_at`), por isso nunca precisa de ser
// calculado/atualizado manualmente no cliente — só lido.
export function daysInStage(lead: Lead): number {
  return Math.floor((Date.now() - new Date(lead.stage_entered_at).getTime()) / 86400000)
}
```

- [ ] **Step 3: Pill "Xd" no card normal**

Em `components/pipeline/KanbanBoard.tsx`, dentro de `LeadCard`, trocar:

```tsx
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          {lead.expected_close_date && (
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {new Date(lead.expected_close_date).toLocaleDateString('pt-PT')}
            </div>
          )}
        </div>
```

por:

```tsx
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span title="Dias nesta fase" style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: 'var(--border)', color: 'var(--muted)' }}>
              {daysInStage(lead)}d
            </span>
            {lead.expected_close_date && (
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                {new Date(lead.expected_close_date).toLocaleDateString('pt-PT')}
              </div>
            )}
          </div>
        </div>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. Se aparecer algum erro de tipo por causa do novo campo obrigatório `stage_entered_at` em algum sítio que construa um objeto `Lead` completo manualmente (não deve haver nenhum — `Lead` só é populado a partir de respostas da API), corrigir adicionando o campo em falta nesse ponto específico, sem alargar o âmbito desta tarefa.

- [ ] **Step 5: Commit**

```bash
git add types/index.ts components/pipeline/KanbanBoard.tsx
git commit -m "feat: show days-in-stage indicator on pipeline cards"
```

---

### Task 2: `CardHoverPreview` — overlay ampliado

**Files:**
- Create: `components/pipeline/CardHoverPreview.tsx`

- [ ] **Step 1: Criar o componente**

Conteúdo completo de `components/pipeline/CardHoverPreview.tsx`:

```tsx
'use client'
import type { Lead } from '@/types'
import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'
import { formatPhoneDisplay } from '@/lib/whatsapp/utils'
import { cardFieldValue, daysInStage, type PipelineCardFields } from '@/components/pipeline/KanbanBoard'

// Overlay centrado no ecrã, mostrado ao fim de ~450ms de hover sobre um
// card (gerido pelo KanbanBoard, não por este componente). Mostra a
// mesma info principal/secundária do card, mas sem cortar texto, mais
// nome/telefone/email e "dias nesta fase". Clicável — dispara a mesma
// ação do clique no card normal (abrir contacto ou navegar para o lead).
// Não repete os ícones de duplicar/trocar imóvel do card normal.
export function CardHoverPreview({ lead, cardFields, onClick, onMouseLeave }: {
  lead: Lead
  cardFields: PipelineCardFields
  onClick: () => void
  onMouseLeave: () => void
}) {
  const primaryText = cardFieldValue(lead, cardFields.primary) ?? lead.people?.name ?? lead.name
  const secondaryText = cardFieldValue(lead, cardFields.secondary)
  const showName = !!lead.people?.name && lead.people.name !== primaryText && lead.people.name !== secondaryText
  const initials = (lead.people?.name ?? lead.name).split(' ').map((n: string) => n[0]).slice(0, 2).join('')
  const phone = lead.people?.phone ?? lead.phone
  const email = lead.people?.email ?? lead.email
  const days = daysInStage(lead)

  return (
    <div
      onMouseLeave={onMouseLeave}
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,13,15,0.35)', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={onClick}
        className="card"
        style={{ width: 360, maxWidth: '90vw', background: 'var(--surface)', borderRadius: 12, padding: '20px 22px', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', flex: 1, minWidth: 0 }}>{primaryText}</div>
          {lead.people?.types && <ContactTypeChips types={lead.people.types} size={10} />}
        </div>
        {secondaryText && secondaryText !== primaryText && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>{secondaryText}</div>
        )}
        {showName && (
          <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 10 }}>👤 {lead.people!.name}</div>
        )}
        {(phone || email) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
            {phone && <div style={{ fontSize: 12, color: 'var(--text)' }}>📞 {formatPhoneDisplay(phone)}</div>}
            {email && <div style={{ fontSize: 12, color: 'var(--text)' }}>✉️ {email}</div>}
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', padding: '4px 10px', borderRadius: 999, background: 'var(--border)', display: 'inline-block' }}>
          {days} dia{days === 1 ? '' : 's'} nesta fase
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
git add components/pipeline/CardHoverPreview.tsx
git commit -m "feat: add enlarged card hover preview component"
```

---

### Task 3: Ligar o hover ao `KanbanBoard`

**Files:**
- Modify: `components/pipeline/KanbanBoard.tsx`

- [ ] **Step 1: Imports**

Trocar:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Lead, PipelineStage, PipelineCardField } from '@/types'
import { useRouter } from 'next/navigation'
import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'
import { CardPropertyModal } from '@/components/pipeline/CardPropertyModal'
import type { Property } from '@/types'
```

por:

```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Lead, PipelineStage, PipelineCardField } from '@/types'
import { useRouter } from 'next/navigation'
import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'
import { CardPropertyModal } from '@/components/pipeline/CardPropertyModal'
import { CardHoverPreview } from '@/components/pipeline/CardHoverPreview'
import type { Property } from '@/types'
```

- [ ] **Step 2: `LeadCard` recebe os handlers de hover**

Trocar a assinatura de `LeadCard`:

```tsx
function LeadCard({ lead, isDragging, onOpenContact, cardFields, onDuplicated, onEditProperty }: { lead: Lead; isDragging?: boolean; onOpenContact?: (personId: string, leadId: string) => void; cardFields: PipelineCardFields; onDuplicated?: () => void; onEditProperty?: (lead: Lead) => void }) {
```

por:

```tsx
function LeadCard({ lead, isDragging, onOpenContact, cardFields, onDuplicated, onEditProperty, onHoverStart, onHoverEnd }: { lead: Lead; isDragging?: boolean; onOpenContact?: (personId: string, leadId: string) => void; cardFields: PipelineCardFields; onDuplicated?: () => void; onEditProperty?: (lead: Lead) => void; onHoverStart?: (lead: Lead) => void; onHoverEnd?: () => void }) {
```

Trocar a `<div>` clicável do card (a que já tem `onClick`):

```tsx
      <div
        onClick={() => {
          if (lead.person_id && onOpenContact) onOpenContact(lead.person_id, lead.id)
          else router.push(`/leads/${lead.id}`)
        }}
        className="card card-hover"
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px 14px', cursor: 'grab', marginBottom: 8, boxShadow: isDragging ? 'var(--shadow-md)' : undefined }}
      >
```

por:

```tsx
      <div
        onClick={() => {
          if (lead.person_id && onOpenContact) onOpenContact(lead.person_id, lead.id)
          else router.push(`/leads/${lead.id}`)
        }}
        onMouseEnter={() => onHoverStart?.(lead)}
        onMouseLeave={() => onHoverEnd?.()}
        className="card card-hover"
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px 14px', cursor: 'grab', marginBottom: 8, boxShadow: isDragging ? 'var(--shadow-md)' : undefined }}
      >
```

- [ ] **Step 3: Estado e temporizador de hover no `KanbanBoard`**

Trocar:

```tsx
export function KanbanBoard({ initialLeads, stages, onOpenContact, cardFields, onDuplicated, onCardUpdated }: Props) {
  const [leads, setLeads] = useState(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingProperty, setEditingProperty] = useState<Lead | null>(null)
```

por:

```tsx
export function KanbanBoard({ initialLeads, stages, onOpenContact, cardFields, onDuplicated, onCardUpdated }: Props) {
  const router = useRouter()
  const [leads, setLeads] = useState(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingProperty, setEditingProperty] = useState<Lead | null>(null)
  const [hoveredLead, setHoveredLead] = useState<Lead | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCardHoverStart(lead: Lead) {
    if (activeId) return
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHoveredLead(lead), 450)
  }

  function handleCardHoverEnd() {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null }
    setHoveredLead(null)
  }

  function openLead(lead: Lead) {
    if (lead.person_id && onOpenContact) onOpenContact(lead.person_id, lead.id)
    else router.push(`/leads/${lead.id}`)
  }
```

- [ ] **Step 4: Suprimir o hover durante o drag**

Trocar:

```tsx
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }
```

por:

```tsx
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null }
    setHoveredLead(null)
  }
```

- [ ] **Step 5: Passar os handlers ao `LeadCard` da coluna (não ao do `DragOverlay`) e renderizar o overlay**

Trocar:

```tsx
                  {stageLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} isDragging={lead.id === activeId} onOpenContact={onOpenContact} cardFields={cardFields} onDuplicated={onDuplicated} onEditProperty={setEditingProperty} />
                  ))}
```

por:

```tsx
                  {stageLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} isDragging={lead.id === activeId} onOpenContact={onOpenContact} cardFields={cardFields} onDuplicated={onDuplicated} onEditProperty={setEditingProperty} onHoverStart={handleCardHoverStart} onHoverEnd={handleCardHoverEnd} />
                  ))}
```

Trocar o final do `return`:

```tsx
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

por:

```tsx
      {editingProperty && (
        <CardPropertyModal
          currentPropertyId={editingProperty.property_id}
          currentPropertyLabel={editingProperty.properties ? (editingProperty.properties.reference ?? editingProperty.properties.title) : null}
          onClose={() => setEditingProperty(null)}
          onSelect={(property: Property) => updateCardProperty({ property_id: property.id, zone: property.zone, typology: property.typology, budget: property.price })}
          onRemove={() => updateCardProperty({ property_id: null })}
        />
      )}
      {hoveredLead && (
        <CardHoverPreview
          lead={hoveredLead}
          cardFields={cardFields}
          onClick={() => { const lead = hoveredLead; setHoveredLead(null); openLead(lead) }}
          onMouseLeave={() => setHoveredLead(null)}
        />
      )}
    </>
  )
}
```

Nota: o `LeadCard` renderizado dentro do `<DragOverlay>` (mais acima no ficheiro) não recebe `onHoverStart`/`onHoverEnd` — fica como está, sem alterações nessa linha.

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add components/pipeline/KanbanBoard.tsx
git commit -m "feat: show enlarged card preview on hover"
```

---

### Task 4: Verificação final

- [ ] **Step 1: Type check completo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build completa sem erros.

- [ ] **Step 3: Lint sobre os ficheiros tocados neste plano**

Run:
```bash
npx eslint types/index.ts components/pipeline/KanbanBoard.tsx components/pipeline/CardHoverPreview.tsx
```
Expected: nenhum erro/aviso novo introduzido por este plano (comparar com os avisos `react-hooks/set-state-in-effect`/`react-hooks/purity` já pré-existentes em `KanbanBoard.tsx` antes deste plano — ver histórico do plano anterior `2026-07-26-pipeline-cards-imovel.md`; este plano não deve adicionar nenhum novo).

- [ ] **Step 4: Nota sobre verificação manual**

Este ambiente não tem sessão autenticada disponível para abrir a app no browser (confirmado em planos anteriores desta sessão). A verificação fica limitada a `tsc`/`build`/`lint`/leitura de código. Registar explicitamente que os seguintes pontos precisam de confirmação visual pelo utilizador antes de considerar a funcionalidade totalmente validada:
1. Hover ≥450ms num card mostra o preview centrado; hover mais curto não mostra nada.
2. O preview mostra texto completo (sem cortar) da info principal/secundária, telefone, email e "X dias nesta fase".
3. Clicar no preview abre o mesmo destino que clicar no card normal.
4. Iniciar um arraste fecha/impede o preview.
5. O pill "Xd" no card normal mostra o mesmo número de dias que o preview, e volta a 0 depois de mudar o card de etapa.

- [ ] **Step 5: Revisão holística**

Dispatch de um review final (subagent `superpowers:code-reviewer`) comparando o diff completo desde antes da Task 1 até ao HEAD contra a spec `docs/superpowers/specs/2026-07-27-card-hover-preview-design.md`, à procura de interações entre tasks — em particular: o temporizador de hover (Task 3) fica mesmo cancelado em todos os caminhos (fim do hover, início de um drag, e desmontagem do componente ao trocar de pipeline — confirmar se falta um `useEffect` de cleanup do `hoverTimer` quando `KanbanBoard` é desmontado, já que `PipelineBoard.tsx` usa `key={selectedId}` no `KanbanBoard`, o que já força uma desmontagem/remontagem completa ao trocar de pipeline e portanto já limpa o `useRef`/estado sem precisar de cleanup explícito — confirmar este raciocínio lendo `PipelineBoard.tsx`).
