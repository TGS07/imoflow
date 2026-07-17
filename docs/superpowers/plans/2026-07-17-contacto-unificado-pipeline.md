# Contacto Unificado (Pipeline ↔ Contactos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicar num card da pipeline abre um painel lateral com o editor completo do contacto (o mesmo da página de Contactos); um contacto pode estar ativo em várias pipelines em simultâneo; pipelines podem ser renomeadas/eliminadas na UI.

**Architecture:** Extrair o corpo de `app/(app)/people/[id]/page.tsx` para um componente partilhado `ContactDetailPanel` usado pela página e por um novo `ContactSlideOver` na pipeline. As APIs de contacto↔pipeline passam a ser *per-pipeline* (`pipeline_id` no POST/DELETE). Sem tabelas novas — `leads.pipeline_id` já existe.

**Tech Stack:** Next.js 16 (App Router, rotas com `params: Promise<...>`), React 19, Supabase JS (sem ORM), Tailwind v4 mas estilos maioritariamente inline (seguir padrão existente). **Sem framework de testes no projeto** — verificação é `npx tsc --noEmit` + preview manual (padrão dos specs anteriores). O `node_modules` pode não estar instalado no worktree; correr `npm install` antes do primeiro type-check.

**Spec:** `docs/superpowers/specs/2026-07-17-contacto-unificado-pipeline-design.md`

---

## Mapa de ficheiros

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `components/contacts/ContactDetailPanel.tsx` | Criar | Todo o detalhe/edição de um contacto (extraído da página) |
| `app/(app)/people/[id]/page.tsx` | Reescrever | Wrapper fino: só renderiza o painel em modo página |
| `components/pipeline/ContactSlideOver.tsx` | Criar | Overlay + gaveta direita que embebe o painel |
| `components/pipeline/KanbanBoard.tsx` | Modificar | Clique no card → callback; chip do tipo de contacto |
| `components/pipeline/PipelineBoard.tsx` | Modificar | Estado do slide-over; renomear/eliminar pipelines |
| `app/api/people/[id]/pipeline/route.ts` | Modificar | POST/DELETE per-pipeline |
| `app/api/people/[id]/route.ts` | Modificar | GET traz `pipeline_id` + nome da pipeline nas leads |
| `app/api/pipelines/[id]/route.ts` | Modificar | DELETE recusa pipelines com leads (400 amigável) |
| `app/api/leads/route.ts` | Modificar | Select inclui `people.types` |
| `app/(app)/leads/[id]/page.tsx` | Modificar | Regular/Responsável read-only quando há contacto |

---

### Task 1: Extrair `ContactDetailPanel` da página de contacto

Refactor puro — zero mudança de comportamento. A página `/people/[id]` fica um wrapper fino.

**Files:**
- Create: `components/contacts/ContactDetailPanel.tsx`
- Rewrite: `app/(app)/people/[id]/page.tsx`

- [ ] **Step 1: Instalar dependências (se necessário) e confirmar baseline**

```bash
npm install
npx tsc --noEmit
```
Expected: sem erros (baseline limpa antes de mexer).

- [ ] **Step 2: Criar `components/contacts/ContactDetailPanel.tsx`**

Copiar TODO o conteúdo de `app/(app)/people/[id]/page.tsx` para o novo ficheiro e aplicar estas alterações (o resto do código fica intacto — hooks, `save()`, `toggleRegular()`, `toggleSpecial()`, special dates, todos os cartões e a coluna direita):

1. Assinatura e imports — substituir o componente default por um export nomeado com props; remover `useParams` (o id vem por prop):

```tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
// ... (mesmos imports da página atual, sem useParams)

export type ContactDetailPanelProps = {
  personId: string
  embedded?: boolean          // true = dentro do slide-over da pipeline
  onClose?: () => void        // fechar o slide-over
  onChanged?: () => void      // avisar o board que dados mudaram
  highlightLeadId?: string    // lead que originou a abertura (realce)
}

export function ContactDetailPanel({ personId, embedded = false, onClose, onChanged, highlightLeadId }: ContactDetailPanelProps) {
  const id = personId
  const router = useRouter()
  // ... resto do estado igual à página atual
```

2. `deletePerson()` — em modo embedded não navega, fecha o painel:

```tsx
  async function deletePerson() {
    if (!confirm('Eliminar esta pessoa? Os leads associados não serão eliminados.')) return
    await fetch(`/api/people/${id}`, { method: 'DELETE' })
    if (embedded) { onChanged?.(); onClose?.() } else { router.push('/people') }
  }
```

3. Propagar mudanças ao board — em todas as funções que fazem PATCH e depois `fetchPerson()` (`save`, `toggleRegular`, `setRegularInterval`, `toggleSpecial`, `updateSpecialFlag`, `addSpecialDate`, `removeSpecialDate`, `addToPipeline`, `removeFromPipeline`), acrescentar `onChanged?.()` a seguir ao `fetchPerson()`. Exemplo em `save()`:

```tsx
    if (res.ok) { setEditing(false); fetchPerson(); onChanged?.() }
```

4. Header — o header sticky atual (breadcrumb "← Pessoas" + ações) passa a ter duas variantes. Substituir o primeiro `<div className="page-pad" style={{ ... position: 'sticky' ...}}>` do return por:

```tsx
      <div className="page-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 10, padding: embedded ? '14px 20px' : '14px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="detail-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          {embedded ? (
            <button onClick={onClose} aria-label="Fechar" className="btn btn-ghost btn-sm" style={{ fontSize: 16, lineHeight: 1, padding: '4px 10px' }}>×</button>
          ) : (
            <>
              <Link href="/people" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 'var(--fs-base)', flexShrink: 0 }}>← Pessoas</Link>
              <span style={{ color: 'var(--border)', flexShrink: 0 }}>/</span>
            </>
          )}
          <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{person.name}</span>
        </div>
        {/* header-actions: bloco existente fica IGUAL (pipeline badge, Editar, Eliminar…) */}
```

5. Layout embedded — a gaveta tem ~560px, não cabe o grid de 2 colunas. No `<div className="two-col-grid" ...>` trocar o estilo por:

```tsx
        <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: embedded ? '1fr' : '1fr 1fr', gap: embedded ? 20 : 24 }}>
```

E no `<div className="page-enter page-pad" style={{ padding: '24px 32px' }}>` usar `padding: embedded ? '20px' : '24px 32px'`.

6. Mover os types locais `LeadSummary`, `PropertyRef`, `PersonDetail` (linhas 16–32 da página atual) para o novo ficheiro e exportar `LeadSummary` (a Task 3 vai estendê-lo).

- [ ] **Step 3: Reescrever `app/(app)/people/[id]/page.tsx`**

Conteúdo completo do ficheiro:

```tsx
'use client'
import { useParams } from 'next/navigation'
import { ContactDetailPanel } from '@/components/contacts/ContactDetailPanel'

export default function PersonPage() {
  const { id } = useParams<{ id: string }>()
  return <ContactDetailPanel personId={id} />
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 5: Verificar no preview que nada mudou**

Iniciar o dev server (preview_start) e abrir `/people`, entrar num contacto: página igual à anterior — editar, guardar, toggles regular/especial, tudo funcional.

- [ ] **Step 6: Commit**

```bash
git add components/contacts/ContactDetailPanel.tsx "app/(app)/people/[id]/page.tsx"
git commit -m "refactor: extrair ContactDetailPanel da página de contacto"
```

---

### Task 2: API contacto↔pipeline per-pipeline

**Files:**
- Modify: `app/api/people/[id]/pipeline/route.ts`

- [ ] **Step 1: POST aceita `pipeline_id`; unicidade só dentro dessa pipeline**

No `POST`, depois de obter `person`, substituir o bloco "Já existe uma lead ativa…" e o bloco `firstStage` por:

```ts
  const body = await request.json().catch(() => ({}))
  let pipelineId: string | null = typeof body.pipeline_id === 'string' ? body.pipeline_id : null

  // Sem pipeline_id → 1ª pipeline da agência (retrocompatível com chamadas antigas)
  if (!pipelineId) {
    const { data: firstPipeline } = await supabase
      .from('pipelines')
      .select('id')
      .eq('agency_id', profile.agency_id)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle()
    pipelineId = firstPipeline?.id ?? null
  }
  if (!pipelineId) return NextResponse.json({ error: 'Agência sem pipelines' }, { status: 400 })

  // Já existe uma lead ativa deste contacto NESTA pipeline?
  const { data: activeLeads } = await supabase
    .from('leads')
    .select('id, pipeline_stages!inner(is_won, is_lost)')
    .eq('person_id', id)
    .eq('pipeline_id', pipelineId)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)
    .limit(1)
  if (activeLeads && activeLeads.length > 0) {
    return NextResponse.json({ error: 'Contacto já está nesta pipeline', lead_id: activeLeads[0].id }, { status: 409 })
  }

  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!firstStage) return NextResponse.json({ error: 'Pipeline sem etapas' }, { status: 400 })
```

E no `insert` da lead acrescentar `pipeline_id: pipelineId,` ao objeto. A assinatura do POST muda de `_: Request` para `request: Request`.

- [ ] **Step 2: DELETE aceita `?lead_id=` ou `?pipeline_id=`**

Substituir o corpo do `DELETE` (a partir do comentário "Apagar as leads ativas…") por:

```ts
  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  const pipelineId = searchParams.get('pipeline_id')

  let query = supabase
    .from('leads')
    .select('id, pipeline_stages!inner(is_won, is_lost)')
    .eq('person_id', id)
    .eq('agency_id', profile.agency_id)
    .eq('pipeline_stages.is_won', false)
    .eq('pipeline_stages.is_lost', false)
  if (leadId) query = query.eq('id', leadId)
  else if (pipelineId) query = query.eq('pipeline_id', pipelineId)
  // sem filtro → remove de todas (comportamento antigo, retrocompatível)

  const { data: activeLeads } = await query
  const ids = (activeLeads ?? []).map(l => l.id)
  if (ids.length > 0) {
    const { error } = await supabase.from('leads').delete().in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ removed: ids.length })
```

A assinatura do DELETE muda de `_: Request` para `request: Request`.

- [ ] **Step 3: Type-check e commit**

```bash
npx tsc --noEmit
git add "app/api/people/[id]/pipeline/route.ts"
git commit -m "feat: adicionar/remover contacto de uma pipeline específica"
```

---

### Task 3: Secção "Negócios ativos" no painel + menu "+ Pipeline"

**Files:**
- Modify: `app/api/people/[id]/route.ts` (GET)
- Modify: `components/contacts/ContactDetailPanel.tsx`

- [ ] **Step 1: GET `/api/people/[id]` traz a pipeline de cada lead**

No select do GET, na linha das leads, acrescentar `pipeline_id` e o join `pipelines(name)`:

```ts
    .select(`*, leads(id, name, stage_id, pipeline_id, deal_value, expected_close_date, created_at, pipeline_stages(name, color, is_won, is_lost), pipelines(name)),
      properties_as_seller:properties!seller_id(id, title, status, price, reference),
      property_consultants(id, properties(id, title, status, price, reference))`)
```

- [ ] **Step 2: Atualizar `LeadSummary` no `ContactDetailPanel`**

```tsx
export type LeadSummary = {
  id: string
  name: string
  stage_id: string
  pipeline_id: string | null
  deal_value: number | null
  expected_close_date: string | null
  created_at: string
  pipeline_stages?: { name: string; color: string; is_won: boolean; is_lost: boolean }
  pipelines?: { name: string } | null
}
```

- [ ] **Step 3: Estado novo no painel — pipelines, etapas por pipeline, leads ativas**

Dentro do componente, substituir a linha `const activeLead = person.leads?.find(...)` (e o `stageColor` derivado) por uma lista, e acrescentar estado/efeitos junto aos outros hooks (topo do componente — hooks não podem ficar depois do `if (!person) return`):

```tsx
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([])
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, { id: string; name: string; is_won: boolean; is_lost: boolean }[]>>({})
  const [pipelineMenuOpen, setPipelineMenuOpen] = useState(false)

  useEffect(() => {
    fetch('/api/pipelines').then(r => r.ok ? r.json() : []).then(setPipelines).catch(() => {})
  }, [])

  // Etapas de cada pipeline com lead ativa (para o seletor inline de etapa)
  useEffect(() => {
    const ids = [...new Set((person?.leads ?? []).map(l => l.pipeline_id).filter((p): p is string => !!p))]
    ids.filter(pid => !stagesByPipeline[pid]).forEach(pid => {
      fetch(`/api/pipeline-stages?pipeline_id=${pid}`)
        .then(r => r.ok ? r.json() : [])
        .then(s => setStagesByPipeline(prev => ({ ...prev, [pid]: s })))
        .catch(() => {})
    })
  }, [person, stagesByPipeline])
```

E depois do `if (!person) return ...`, onde estava `const activeLead = ...`:

```tsx
  // Leads "ativas" = etapa não fechada/perdida; pode haver uma por pipeline
  const activeLeads = (person.leads ?? []).filter(l => l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost)
  const missingPipelines = pipelines.filter(p => !activeLeads.some(l => l.pipeline_id === p.id))
```

- [ ] **Step 4: Funções de ação per-pipeline**

Substituir `addToPipeline()` e `removeFromPipeline()`:

```tsx
  async function addToPipeline(pipelineId: string) {
    setPipelineBusy(true)
    setPipelineMenuOpen(false)
    try {
      const res = await fetch(`/api/people/${id}/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_id: pipelineId }),
      })
      if (res.ok) { fetchPerson(); onChanged?.() }
    } finally {
      setPipelineBusy(false)
    }
  }

  async function removeFromPipeline(leadId: string) {
    if (!confirm('Remover desta pipeline? A lead é apagada; o contacto e o histórico ficam.')) return
    setPipelineBusy(true)
    try {
      const res = await fetch(`/api/people/${id}/pipeline?lead_id=${leadId}`, { method: 'DELETE' })
      if (res.ok) { fetchPerson(); onChanged?.() }
    } finally {
      setPipelineBusy(false)
    }
  }

  async function changeLeadStage(leadId: string, stageId: string) {
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: stageId }),
    })
    fetchPerson(); onChanged?.()
  }
```

- [ ] **Step 5: Header — badge único dá lugar ao menu "+ Pipeline"**

No bloco `header-actions`, substituir o ternário `activeLead ? (...) : (...)` por (o "Remover" sai do header, passa para as linhas do card Negócios no Step 6):

```tsx
          {!editing && missingPipelines.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setPipelineMenuOpen(o => !o)} disabled={pipelineBusy} className="btn btn-soft">
                {pipelineBusy ? 'A adicionar…' : '+ Pipeline'}
              </button>
              {pipelineMenuOpen && (
                <div className="card" style={{ position: 'absolute', top: '110%', right: 0, zIndex: 30, minWidth: 180, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, boxShadow: 'var(--shadow-md)' }}>
                  {missingPipelines.map(p => (
                    <button key={p.id} onClick={() => addToPipeline(p.id)} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}>{p.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}
```

O stat "Pipeline" do hero (que usava `activeLead`) passa a:

```tsx
                { label: 'Pipeline', value: activeLeads.length > 0 ? `${activeLeads.length} ativa${activeLeads.length > 1 ? 's' : ''}` : 'Fora' },
```

Nota: `stageColor` deixa de existir — remover a variável e os usos no header antigo.

- [ ] **Step 6: Card "Negócios" — linha por lead ativa com seletor de etapa**

Substituir o `person.leads.map(lead => ...)` do card Negócios por: leads ativas primeiro (com controlos), depois as fechadas (como estavam). Código do novo corpo do card:

```tsx
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeLeads.map(lead => {
                    const stages = lead.pipeline_id ? (stagesByPipeline[lead.pipeline_id] ?? []) : []
                    const highlight = lead.id === highlightLeadId
                    return (
                      <div key={lead.id} className="card" style={{ borderRadius: 10, padding: '12px 14px', boxShadow: 'none', border: highlight ? '1px solid var(--gold)' : undefined }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)' }}>{lead.pipelines?.name ?? 'Pipeline'}</div>
                          {lead.deal_value != null && lead.deal_value > 0 && (
                            <div className="font-display" style={{ fontSize: 'var(--fs-md)', color: 'var(--gold)' }}>€{lead.deal_value.toLocaleString('pt-PT')}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                          <select className="input" style={{ width: 'auto', minWidth: 140 }} value={lead.stage_id} onChange={e => changeLeadStage(lead.id, e.target.value)}>
                            {stages.filter(s => !s.is_lost).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <Link href={`/leads/${lead.id}`} style={{ fontSize: 'var(--fs-xs)', color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Ver negócio completo →</Link>
                          <button onClick={() => removeFromPipeline(lead.id)} disabled={pipelineBusy} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>Remover</button>
                        </div>
                      </div>
                    )
                  })}
                  {(person.leads ?? []).filter(l => !activeLeads.includes(l)).map(lead => {
                    const stage = lead.pipeline_stages
                    return (
                      <Link key={lead.id} href={`/leads/${lead.id}`} className="card card-hover" style={{ textDecoration: 'none', color: 'inherit', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, boxShadow: 'none' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            {stage && (
                              <span style={{ fontSize: 'var(--fs-2xs)', padding: '2px 9px', borderRadius: 999, background: `${stage.color}1A`, border: `1px solid ${stage.color}40`, color: stage.color, fontWeight: 600 }}>{stage.name}</span>
                            )}
                            <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)' }}>{new Date(lead.created_at).toLocaleDateString('pt-PT')}</span>
                          </div>
                        </div>
                        {lead.deal_value != null && lead.deal_value > 0 && (
                          <div className="font-display" style={{ fontSize: 'var(--fs-md)', color: 'var(--gold)', whiteSpace: 'nowrap' }}>€{lead.deal_value.toLocaleString('pt-PT')}</div>
                        )}
                      </Link>
                    )
                  })}
                </div>
```

Manter o "empty state" existente quando não há leads nenhumas.

- [ ] **Step 7: Type-check e preview**

```bash
npx tsc --noEmit
```
Preview: num contacto, "+ Pipeline" mostra menu com as pipelines em falta; adicionar a "Vendedores" e a "Compradores" → duas linhas em Negócios, cada uma com o seletor da SUA pipeline; mudar etapa por ali; "Remover" tira só uma.

- [ ] **Step 8: Commit**

```bash
git add "app/api/people/[id]/route.ts" components/contacts/ContactDetailPanel.tsx
git commit -m "feat: negócios ativos por pipeline no painel do contacto"
```

---

### Task 4: Slide-over na Pipeline

**Files:**
- Create: `components/pipeline/ContactSlideOver.tsx`
- Modify: `components/pipeline/KanbanBoard.tsx`
- Modify: `components/pipeline/PipelineBoard.tsx`

- [ ] **Step 1: Criar `components/pipeline/ContactSlideOver.tsx`**

Conteúdo completo:

```tsx
'use client'
import { useEffect } from 'react'
import { ContactDetailPanel } from '@/components/contacts/ContactDetailPanel'

type Props = {
  personId: string
  highlightLeadId?: string
  onClose: () => void
  onChanged?: () => void
}

// Gaveta lateral com a ficha completa do contacto, sobre o board da pipeline.
export function ContactSlideOver({ personId, highlightLeadId, onClose, onChanged }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,5,0.25)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(560px, 100vw)', background: 'var(--bg)', boxShadow: 'var(--shadow-md)', overflowY: 'auto', animation: 'slideIn 0.2s ease' }}>
        <ContactDetailPanel personId={personId} embedded onClose={onClose} onChanged={onChanged} highlightLeadId={highlightLeadId} />
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(24px); opacity: 0.6 } to { transform: translateX(0); opacity: 1 } }`}</style>
    </div>
  )
}
```

- [ ] **Step 2: `KanbanBoard` — clique abre o contacto via callback**

Em `components/pipeline/KanbanBoard.tsx`:

1. `Props` ganha o callback e passa-o às cards:

```tsx
type Props = {
  initialLeads: Lead[]
  stages: PipelineStage[]
  onOpenContact?: (personId: string, leadId: string) => void
}

export function KanbanBoard({ initialLeads, stages, onOpenContact }: Props) {
```

2. `LeadCard` recebe `onOpenContact` e decide no clique (lead sem contacto mantém a navegação antiga):

```tsx
function LeadCard({ lead, isDragging, onOpenContact }: { lead: Lead; isDragging?: boolean; onOpenContact?: (personId: string, leadId: string) => void }) {
  // ...
      <div
        onClick={() => {
          if (lead.person_id && onOpenContact) onOpenContact(lead.person_id, lead.id)
          else router.push(`/leads/${lead.id}`)
        }}
```

3. Nos dois sítios que renderizam `<LeadCard>` (coluna e `DragOverlay`), passar `onOpenContact={onOpenContact}`.

- [ ] **Step 3: `PipelineBoard` — estado e render do slide-over**

Em `components/pipeline/PipelineBoard.tsx`:

```tsx
import { ContactSlideOver } from '@/components/pipeline/ContactSlideOver'
// ...
  const [openContact, setOpenContact] = useState<{ personId: string; leadId: string } | null>(null)
```

No JSX, junto aos outros modais:

```tsx
      {openContact && (
        <ContactSlideOver
          personId={openContact.personId}
          highlightLeadId={openContact.leadId}
          onClose={() => setOpenContact(null)}
          onChanged={() => selectedId && loadBoard(selectedId)}
        />
      )}
```

E no `<KanbanBoard>`:

```tsx
          <KanbanBoard key={selectedId} initialLeads={leads} stages={stages} onOpenContact={(personId, leadId) => setOpenContact({ personId, leadId })} />
```

- [ ] **Step 4: Type-check e preview**

```bash
npx tsc --noEmit
```
Preview: na Pipeline, clicar num card com contacto → gaveta abre com a ficha completa, a lead que originou o clique aparece realçada em Negócios; editar nome e guardar → fecha-se a edição; fechar a gaveta → board atualizado (nome novo no card). Esc e clique fora fecham. Drag continua a funcionar (o `activationConstraint: distance 8` distingue drag de clique).

- [ ] **Step 5: Commit**

```bash
git add components/pipeline/ContactSlideOver.tsx components/pipeline/KanbanBoard.tsx components/pipeline/PipelineBoard.tsx
git commit -m "feat: slide-over do contacto ao clicar num card da pipeline"
```

---

### Task 5: Tipo de contacto visível no card do Kanban

**Files:**
- Modify: `app/api/leads/route.ts`
- Modify: `components/pipeline/KanbanBoard.tsx`

- [ ] **Step 1: GET `/api/leads` traz os tipos do contacto**

No select do GET, trocar `people(id, name, email, phone)` por `people(id, name, email, phone, types)`.

- [ ] **Step 2: Chip do tipo no `LeadCard`**

Import no topo de `KanbanBoard.tsx`:

```tsx
import { contactTypeMeta } from '@/lib/contacts/constants'
```

Dentro de `LeadCard`, antes do `return`:

```tsx
  const typeMeta = lead.people?.types?.length ? contactTypeMeta(lead.people.types[0]) : null
```

E na linha do nome (o `<div>` com `fontWeight: 500, fontSize: 13`), acrescentar o chip a seguir ao nome, dentro do mesmo flex row do avatar:

```tsx
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
          {typeMeta && (
            <span title={typeMeta.label} style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: `${typeMeta.color}18`, color: typeMeta.color, border: `1px solid ${typeMeta.color}40`, flexShrink: 0 }}>
              {typeMeta.label.split(' ')[0]}
            </span>
          )}
```

- [ ] **Step 3: Type-check, preview e commit**

```bash
npx tsc --noEmit
```
Preview: cards de leads ligadas a contactos mostram o chip colorido (Comprador azul, Vendedor verde, Investidor roxo…).

```bash
git add app/api/leads/route.ts components/pipeline/KanbanBoard.tsx
git commit -m "feat: chip do tipo de contacto no card do kanban"
```

---

### Task 6: Renomear/eliminar pipelines na UI + guard no DELETE

**Files:**
- Modify: `app/api/pipelines/[id]/route.ts`
- Modify: `components/pipeline/PipelineBoard.tsx`

- [ ] **Step 1: DELETE recusa pipelines com leads**

Em `app/api/pipelines/[id]/route.ts`, no `DELETE`, depois da verificação "última pipeline" e antes do delete:

```ts
  // Recusar se a pipeline tiver leads — o delete em cascata das etapas
  // falharia na FK de leads.stage_id com um erro críptico do Postgres.
  const { count: leadCount } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('pipeline_id', id)
  if ((leadCount ?? 0) > 0) {
    return NextResponse.json({ error: `Esta pipeline tem ${leadCount} contacto(s) — move-os ou remove-os primeiro.` }, { status: 400 })
  }
```

- [ ] **Step 2: UI de renomear/eliminar na aba ativa**

Em `components/pipeline/PipelineBoard.tsx`, acrescentar as funções junto a `createPipeline()`:

```tsx
  async function renamePipeline(p: Pipeline) {
    const name = prompt('Novo nome da pipeline:', p.name)
    if (!name || !name.trim() || name.trim() === p.name) return
    const res = await fetch(`/api/pipelines/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (res.ok) {
      const updated: Pipeline = await res.json()
      setPipelines(prev => prev.map(x => x.id === p.id ? updated : x))
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Erro ao renomear pipeline.')
    }
  }

  async function deletePipeline(p: Pipeline) {
    if (!confirm(`Eliminar a pipeline "${p.name}"? As etapas são apagadas.`)) return
    const res = await fetch(`/api/pipelines/${p.id}`, { method: 'DELETE' })
    if (res.ok) {
      setPipelines(prev => prev.filter(x => x.id !== p.id))
      if (selectedId === p.id) setSelectedId(null) // loadPipelines escolhe a 1ª
      loadPipelines()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Erro ao eliminar pipeline.')
    }
  }
```

E no seletor de abas, a aba ativa (quando `isAdmin`) ganha os dois ícones inline — substituir o `pipelines.map(...)` por:

```tsx
            {pipelines.map(p => (
              <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button
                  onClick={() => setSelectedId(p.id)}
                  className={`chip${p.id === selectedId ? ' active' : ''}`}
                  style={isAdmin && p.id === selectedId ? { ...tabBase, borderTopRightRadius: 0, borderBottomRightRadius: 0 } : tabBase}
                >
                  {p.name}
                </button>
                {isAdmin && p.id === selectedId && (
                  <>
                    <button onClick={() => renamePipeline(p)} title="Renomear pipeline" className="chip active" style={{ ...tabBase, padding: '0 8px', borderRadius: 0, borderLeft: 'none' }}>✏️</button>
                    <button onClick={() => deletePipeline(p)} title="Eliminar pipeline" className="chip active" style={{ ...tabBase, padding: '0 8px', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 'none' }}>🗑️</button>
                  </>
                )}
              </span>
            ))}
```

- [ ] **Step 3: Type-check, preview e commit**

```bash
npx tsc --noEmit
```
Preview (como admin): renomear a pipeline ativa → aba atualiza; eliminar pipeline com leads → alerta "tem N contacto(s)"; criar uma pipeline vazia e eliminá-la → some e o board muda para a primeira; tentar eliminar quando só existe uma → erro "pelo menos uma pipeline".

```bash
git add "app/api/pipelines/[id]/route.ts" components/pipeline/PipelineBoard.tsx
git commit -m "feat: renomear e eliminar pipelines na UI, com guard de leads"
```

---

### Task 7: Follow-ups/responsável só no contacto na página de lead

**Files:**
- Modify: `app/(app)/leads/[id]/page.tsx`

- [ ] **Step 1: Controlos condicionais no header**

A regra: se `lead.people` existe, a fonte de verdade é o contacto — mostrar só leitura + atalho para a ficha; sem contacto, manter os controlos da lead como fallback. Substituir, no bloco `header-actions`, o `<select>` de responsável e o botão "Regular" por:

```tsx
          {lead.people ? (
            <Link href={`/people/${lead.people.id}`} title="Gerido na ficha do contacto" className="chip" style={{ height: 30, textDecoration: 'none' }}>
              {lead.people.is_regular ? '✓ Regular' : 'Não regular'} · {members.find(m => m.id === lead.people?.assigned_to)?.name ?? 'Sem responsável'} ↗
            </Link>
          ) : (
            <>
              <select value={lead.assigned_to ?? ''} onChange={e => updateAssignee(e.target.value)} title="Responsável" style={{ height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 12, padding: '0 8px', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                <option value="">Sem responsável</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button onClick={toggleRegular} title="Follow-ups automáticos" className={`chip${lead.is_regular ? ' active' : ''}`} style={{ height: 30 }}>
                {lead.is_regular ? '✓ Regular' : 'Regular'}
              </button>
            </>
          )}
```

Nota: `lead.people` é `Person` (o GET `/api/leads/[id]` devolve `people(*)` — verificar; se o select for parcial, acrescentar `is_regular, assigned_to` aos campos de `people` nesse select em `app/api/leads/[id]/route.ts`).

- [ ] **Step 2: Secção de frequência só para leads sem contacto**

Trocar a condição do bloco "Frequência de follow-up própria" de `{lead.is_regular && (` para `{!lead.people && lead.is_regular && (`.

- [ ] **Step 3: Type-check, preview e commit**

```bash
npx tsc --noEmit
```
Preview: lead COM contacto → header mostra o resumo "✓ Regular · {nome} ↗" clicável para a ficha; lead SEM contacto → controlos antigos intactos.

```bash
git add "app/(app)/leads/[id]/page.tsx" "app/api/leads/[id]/route.ts"
git commit -m "feat: regular/responsável geridos no contacto quando a lead tem contacto"
```

---

### Task 8: Verificação final

- [ ] **Step 1: Build completo**

```bash
npm run build
```
Expected: build sem erros.

- [ ] **Step 2: Passagem completa no preview**

1. `/pipeline`: clicar card → gaveta; editar contacto na gaveta; fechar → card reflete.
2. Na gaveta: "+ Pipeline" → adicionar o mesmo contacto a uma 2ª pipeline; mudar de aba na pipeline → o contacto aparece nas duas.
3. Em Negócios ativos: mudar etapa pelo seletor; "Remover" de uma pipeline não afeta a outra.
4. Renomear/eliminar pipelines (com e sem leads).
5. `/people/[id]`: comportamento idêntico à gaveta (mesmo componente).
6. `/leads/[id]` de uma lead com contacto: campos read-only; de uma sem contacto: editáveis.

- [ ] **Step 3: Commit final de eventuais correções**

```bash
git add -A && git commit -m "fix: ajustes da verificação do contacto unificado"
```
(Só se a verificação obrigar a mudanças.)
