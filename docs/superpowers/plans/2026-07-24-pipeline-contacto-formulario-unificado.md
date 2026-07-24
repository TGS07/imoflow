# Formulário unificado Lead/Contacto + fixes de Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Novo Lead" passa a ter exatamente os mesmos campos que "Novo Contacto" (tipo, detalhes por tipo, capacidade financeira, link Idealista), permite marcar várias pipelines de uma vez na criação, e três bugs/limitações ficam corrigidos: eliminar uma pipeline com leads deixa de bloquear, o nome no card do Kanban deixa de ficar desatualizado, e o "+ Pipeline" de um contacto existente passa a aceitar seleção múltipla.

**Architecture:** Extrai-se um componente partilhado `ContactFormFields` das secções de tipo/detalhes/capacidade/origem/responsável do `NewContactModal`, reutilizado pelo `NewLeadModal` quando se cria uma pessoa nova. Sem tabela nova — só uma coluna (`properties.idealista_url`) e um campo novo em `ContactDetails` (jsonb, sem migração). Multi-pipeline na criação é só um loop client-side a `POST /api/leads` (endpoint já existente, sem mudanças). Eliminar pipeline passa a apagar as leads primeiro (FKs de leads já são `ON DELETE CASCADE` em todo o lado — confirmado em `001_initial.sql`).

**Tech Stack:** Next.js (rotas com `params: Promise<...>`), React, Supabase (Postgres + RLS). **Sem framework de testes** — verificação é `npx tsc --noEmit` + preview no browser. Continuar no branch atual `claude/pipeline-lead-contact-forms-1699c3` (worktree `zen-kare-42694c`) — não criar branch novo.

**Spec:** `docs/superpowers/specs/2026-07-24-pipeline-contacto-formulario-unificado-design.md`

---

## Mapa de ficheiros

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `types/contact.ts` | Modificar | `idealista_url` em `ContactDetails` |
| `types/index.ts` | Modificar | `idealista_url` em `Property` |
| `supabase/migrations/20260724120000_properties_idealista_url.sql` | Criar | Coluna nova em `properties` |
| `components/contacts/ContactFormFields.tsx` | Criar | Campos de contacto partilhados (tipo, capacidade, origem, detalhes, Idealista, responsável, nascimento, regular) |
| `components/contacts/NewContactModal.tsx` | Modificar | Passa a usar `ContactFormFields` |
| `components/leads/NewLeadModal.tsx` | Modificar | Usa `ContactFormFields` quando não há pessoa escolhida; multi-pipeline; nome bloqueado ao nome do contacto quando ligado |
| `components/pipeline/PipelineBoard.tsx` | Modificar | `pipelineId` → `defaultPipelineIds` no `NewLeadModal` |
| `app/(app)/leads/page.tsx` | Nenhuma mudança | `NewLeadModal` sem `defaultPipelineIds` já funciona (fallback interno escolhe a 1ª pipeline) |
| `components/contacts/ContactDetailPanel.tsx` | Modificar | "+ Pipeline" com checkboxes; campo Idealista na vista/edição |
| `app/api/pipelines/[id]/route.ts` | Modificar | `DELETE` deixa de bloquear com leads existentes |
| `components/pipeline/KanbanBoard.tsx` | Modificar | `cardFieldValue('name')` usa `lead.people?.name` |
| `app/(app)/properties/page.tsx` | Modificar | Campo Idealista no formulário de criação |
| `app/(app)/properties/[id]/page.tsx` | Modificar | Campo Idealista na vista/edição |

## Factos do código (verificados — não re-descobrir)

- `NewContactModal.tsx` já usa um `setDetail`-like helper `d(k, v)` não genérico; `ContactDetailPanel.tsx:274-275` já tem a versão genérica correta: `const setDetail = <K extends keyof ContactDetails>(k: K, v: ContactDetails[K]) => setForm(p => ({ ...p, details: { ...p.details, [k]: v } }))`. Vamos replicar esta assinatura genérica em `NewContactModal` e `NewLeadModal` para serem compatíveis com a prop `onDetailChange` de `ContactFormFields`.
- `POST /api/people` (`app/api/people/route.ts`) já aceita exatamente os campos que `ContactFormFields` edita: `types, financial_capacity, source, details, notes, birthday, is_regular, assigned_to` — nenhuma mudança de API necessária.
- `POST /api/leads` (`app/api/leads/route.ts`) já resolve `stage_id` a partir de `pipeline_id` quando `stage_id` não vem no body — chamar em loop (uma vez por pipeline marcada) já basta, sem endpoint novo.
- Todos os FKs `lead_id` no schema usam `ON DELETE CASCADE` (`001_initial.sql:42,54,65`, `20260530_activities.sql:5`, `20260531_automations.sql:30`, `20260611_whatsapp_and_agency_email.sql:28`) — apagar leads em massa por `pipeline_id` é seguro, sem limpeza extra.
- `GET /api/leads?pipeline_id=` (usado pelo `PipelineBoard`) já faz select de `people(id, name, email, phone, types)` — o `name` do contacto já vem disponível em `lead.people.name`, não precisa de mudança de query para o bug do nome desatualizado.
- `DELETE /api/people/[id]/pipeline` já só apaga a lead (nunca `people`/`organizations`/`properties`) — confirmado, não mexer.
- `PATCH /api/people/[id]` já tem `details` na whitelist de campos aceites — nenhuma mudança de API para o campo Idealista do contacto.
- `PATCH`/`POST /api/properties` não têm whitelist — passam o body completo para o `update`/`insert` do Supabase — basta a coluna existir na tabela.
- Projeto Supabase: confirmar o `project_id` correto com `list_projects` antes de aplicar a migração (não assumir um id de uma sessão anterior).

---

### Task 1: Modelo de dados — `idealista_url`

**Files:**
- Modify: `types/contact.ts`
- Modify: `types/index.ts`
- Create: `supabase/migrations/20260724120000_properties_idealista_url.sql`

- [ ] **Step 1: Adicionar `idealista_url` a `ContactDetails`**

Em `types/contact.ts`, dentro de `export type ContactDetails = {`, adicionar como primeiro campo (antes do comentário `// comprador / investidor`):

```ts
export type ContactDetails = {
  // link do anúncio no Idealista — campo geral, independente do tipo (comprador/vendedor/investidor)
  idealista_url?: string
  // comprador / investidor
  looking_for?: string
  ...
```

(mantém o resto do ficheiro inalterado — só esta linha nova a seguir a `{`).

- [ ] **Step 2: Adicionar `idealista_url` a `Property`**

Em `types/index.ts`, no `export type Property = {`, adicionar a seguir a `notes: string | null,`:

```ts
  notes: string | null
  idealista_url: string | null
  seller_id: string | null
```

- [ ] **Step 3: Migração da coluna**

Criar `supabase/migrations/20260724120000_properties_idealista_url.sql`:

```sql
-- Link do anúncio do imóvel no Idealista (texto livre, sem validação de
-- formato). Pedido do cliente para poder colar o link do anúncio existente.
ALTER TABLE public.properties ADD COLUMN idealista_url TEXT;
```

- [ ] **Step 4: Aplicar a migração ao Supabase**

Primeiro confirmar o projeto correto:

```
mcp__815f2f4b-6ae5-4702-9098-ffa5c7ad7442__list_projects
```

Depois aplicar com `apply_migration` (nome `properties_idealista_url`, projeto encontrado no passo anterior), usando o conteúdo exato do `.sql` criado no Step 3.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados com `ContactDetails`/`Property`.

- [ ] **Step 6: Commit**

```bash
git add types/contact.ts types/index.ts supabase/migrations/20260724120000_properties_idealista_url.sql
git commit -m "feat: add idealista_url field to contacts and properties"
```

---

### Task 2: Componente partilhado `ContactFormFields` + `NewContactModal`

**Files:**
- Create: `components/contacts/ContactFormFields.tsx`
- Modify: `components/contacts/NewContactModal.tsx`

- [ ] **Step 1: Criar `ContactFormFields.tsx`**

Conteúdo completo:

```tsx
'use client'
import {
  CONTACT_TYPES, CAPACITY_BANDS, CONTACT_SOURCES, SOURCE_LABELS,
  type ContactTypeKey,
} from '@/lib/contacts/constants'
import type { ContactDetails } from '@/types'

export type Member = { id: string; name: string; avatar_initials: string }

type Props = {
  types: ContactTypeKey[]
  onToggleType: (t: ContactTypeKey) => void
  capacity: string
  onCapacityChange: (v: string) => void
  source: string
  onSourceChange: (v: string) => void
  details: ContactDetails
  onDetailChange: <K extends keyof ContactDetails>(k: K, v: ContactDetails[K]) => void
  assignedTo: string
  onAssignedToChange: (v: string) => void
  members: Member[]
  birthday: string
  onBirthdayChange: (v: string) => void
  isRegular: boolean
  onIsRegularChange: (v: boolean) => void
}

const cb = { width: 15, height: 15, accentColor: '#B07D2E', cursor: 'pointer' as const }
const sectionLabel = { fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 6 }

// Campos de contacto partilhados entre "Novo Contacto" (NewContactModal) e
// "Novo Lead" (NewLeadModal, quando não se escolhe uma pessoa já existente
// no autocomplete) — mesmo esquema de campos nos dois sítios.
export function ContactFormFields({
  types, onToggleType, capacity, onCapacityChange, source, onSourceChange,
  details, onDetailChange, assignedTo, onAssignedToChange, members,
  birthday, onBirthdayChange, isRegular, onIsRegularChange,
}: Props) {
  const has = (t: ContactTypeKey) => types.includes(t)

  return (
    <>
      <div>
        <div style={sectionLabel}>Tipo</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CONTACT_TYPES.map(meta => {
            const active = has(meta.key)
            return (
              <button
                key={meta.key}
                type="button"
                onClick={() => onToggleType(meta.key)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  background: active ? `${meta.color}18` : 'var(--surface)',
                  color: active ? meta.color : 'var(--muted)',
                  border: active ? `1px solid ${meta.color}55` : '1px solid var(--border)',
                }}
              >
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {(has('comprador') || has('investidor')) && (
        <div>
          <div style={sectionLabel}>Capacidade financeira</div>
          <select className="input" value={capacity} onChange={e => onCapacityChange(e.target.value)}>
            <option value="">—</option>
            {CAPACITY_BANDS.map(b => (
              <option key={b.key} value={b.key}>{b.label} ({b.range})</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div style={sectionLabel}>Origem</div>
        <select className="input" value={source} onChange={e => onSourceChange(e.target.value)}>
          <option value="">—</option>
          {CONTACT_SOURCES.map(s => (
            <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div>
        <div style={sectionLabel}>Link do anúncio Idealista</div>
        <input
          className="input"
          placeholder="https://www.idealista.pt/imovel/..."
          value={details.idealista_url ?? ''}
          onChange={e => onDetailChange('idealista_url', e.target.value)}
        />
      </div>

      {(has('comprador') || has('investidor')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={sectionLabel}>Procura</div>
          <input className="input" placeholder="O que procura" value={details.looking_for ?? ''} onChange={e => onDetailChange('looking_for', e.target.value)} />
          <input className="input" placeholder="Zona" value={details.search_zone ?? ''} onChange={e => onDetailChange('search_zone', e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" style={cb} checked={!!details.already_bought} onChange={e => onDetailChange('already_bought', e.target.checked)} />
            Já comprou connosco
          </label>
        </div>
      )}

      {(has('vendedor') || has('investidor')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={sectionLabel}>Venda</div>
          <input className="input" placeholder={has('vendedor') ? 'O que vende' : 'O que oferece'} value={details.selling_property ?? ''} onChange={e => onDetailChange('selling_property', e.target.value)} />
          <input className="input" placeholder="Onde vende" value={details.selling_zone ?? ''} onChange={e => onDetailChange('selling_zone', e.target.value)} />
          <input className="input" type="number" placeholder="Preço (€)" value={details.selling_price ?? ''} onChange={e => onDetailChange('selling_price', Number(e.target.value) || undefined)} />
          <input className="input" placeholder="Tipologia" value={details.typology ?? ''} onChange={e => onDetailChange('typology', e.target.value)} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={cb} checked={!!details.has_garage} onChange={e => onDetailChange('has_garage', e.target.checked)} />
              Garagem
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={cb} checked={!!details.has_balcony} onChange={e => onDetailChange('has_balcony', e.target.checked)} />
              Varanda
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={cb} checked={!!details.has_exclusivity} onChange={e => onDetailChange('has_exclusivity', e.target.checked)} />
              Exclusividade
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={cb} checked={!!details.is_active_seller} onChange={e => onDetailChange('is_active_seller', e.target.checked)} />
              Vendedor ativo
            </label>
          </div>
        </div>
      )}

      {has('consultor') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={sectionLabel}>Consultor Imobiliário</div>
          <input className="input" placeholder="Agência" value={details.agency_name ?? ''} onChange={e => onDetailChange('agency_name', e.target.value)} />
          <input className="input" placeholder="Zona de atuação" value={details.working_zone ?? ''} onChange={e => onDetailChange('working_zone', e.target.value)} />
        </div>
      )}

      {has('servico') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={sectionLabel}>Serviço</div>
          <input className="input" placeholder="O que faz (ex: canalizador, eletricista)" value={details.service_type ?? ''} onChange={e => onDetailChange('service_type', e.target.value)} />
          <input className="input" placeholder="Zona de atuação" value={details.working_zone ?? ''} onChange={e => onDetailChange('working_zone', e.target.value)} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={sectionLabel}>Responsável *</div>
          <select className="input" value={assignedTo} onChange={e => onAssignedToChange(e.target.value)} required>
            <option value="" disabled>Escolher…</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <div style={sectionLabel}>Nascimento</div>
          <input className="input" type="date" value={birthday} onChange={e => onBirthdayChange(e.target.value)} />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <input type="checkbox" style={cb} checked={isRegular} onChange={e => onIsRegularChange(e.target.checked)} />
        <span>
          <span style={{ fontWeight: 600 }}>Contacto regular</span>
          <span style={{ color: 'var(--muted)', marginLeft: 6 }}>— com follow-ups automáticos</span>
        </span>
      </label>
    </>
  )
}
```

- [ ] **Step 2: Atualizar `NewContactModal.tsx` para usar `ContactFormFields`**

No topo do ficheiro, trocar:

```tsx
import {
  CONTACT_TYPES, CAPACITY_BANDS, CONTACT_SOURCES, SOURCE_LABELS,
  type ContactTypeKey,
} from '@/lib/contacts/constants'
```

por:

```tsx
import { type ContactTypeKey } from '@/lib/contacts/constants'
import { ContactFormFields, type Member } from '@/components/contacts/ContactFormFields'
```

Remover a declaração local `type Member = { id: string; name: string; avatar_initials: string }` (linha 22 do ficheiro original) — passa a vir de `ContactFormFields`.

Remover as constantes `cb` e `sectionLabel` (deixam de ser usadas neste ficheiro depois da extração).

Trocar a função `d` por uma versão genérica (mesma assinatura usada em `ContactDetailPanel.tsx:274-275`):

```tsx
  const setDetail = <K extends keyof ContactDetails>(k: K, v: ContactDetails[K]) =>
    setDetails(p => ({ ...p, [k]: v }))
```

(substitui a linha `const d = (k: keyof ContactDetails, v: unknown) => setDetails(p => ({ ...p, [k]: v }))`.)

Substituir todo o bloco JSX desde `<div><div style={sectionLabel}>Tipo</div>` (logo a seguir ao aviso de duplicado) até ao fim do bloco `<label>...Contacto regular...</label>` (inclusive) por:

```tsx
          <ContactFormFields
            types={types} onToggleType={toggleType}
            capacity={capacity} onCapacityChange={setCapacity}
            source={source} onSourceChange={setSource}
            details={details} onDetailChange={setDetail}
            assignedTo={assignedTo} onAssignedToChange={setAssignedTo} members={members}
            birthday={birthday} onBirthdayChange={setBirthday}
            isRegular={isRegular} onIsRegularChange={setIsRegular}
          />
```

O resto do ficheiro (nome/email/telefone, aviso de duplicado, notas, botões) mantém-se inalterado.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. Se aparecer "unused variable" para `cb`/`sectionLabel`/`CONTACT_TYPES` etc., confirma que foram todos removidos do `NewContactModal.tsx`.

- [ ] **Step 4: Verificação manual**

Preview: abrir "Novo Contacto" em `/people`, confirmar visualmente que o formulário fica igual ao que era antes (tipo, capacidade, origem, detalhes por tipo, responsável, nascimento, regular) — só que agora com o novo campo "Link do anúncio Idealista" a seguir a Origem. Criar um contacto de teste do tipo vendedor com o link preenchido e confirmar que aparece em `/people/{id}`.

- [ ] **Step 5: Commit**

```bash
git add components/contacts/ContactFormFields.tsx components/contacts/NewContactModal.tsx
git commit -m "refactor: extract ContactFormFields shared component from NewContactModal"
```

---

### Task 3: Unificar `NewLeadModal` (campos de contacto + multi-pipeline + nome bloqueado ao contacto)

**Files:**
- Modify: `components/leads/NewLeadModal.tsx`
- Modify: `components/pipeline/PipelineBoard.tsx`

- [ ] **Step 1: Reescrever `NewLeadModal.tsx`**

Conteúdo completo do novo ficheiro:

```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { LeadSource, CustomField, Person, Organization, Property, Pipeline, ContactDetails } from '@/types'
import { AudioRecorder } from '@/components/shared/AudioRecorder'
import { ContactFormFields, type Member } from '@/components/contacts/ContactFormFields'
import type { ContactTypeKey } from '@/lib/contacts/constants'

type Props = {
  onClose: () => void
  onCreated: () => void
  initialPerson?: Person
  initialValues?: Partial<{ zone: string; typology: string; budget: number }>
  defaultPipelineIds?: string[]
}

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'site', label: '🌐 Site' },
  { value: 'instagram', label: '📱 Instagram' },
  { value: 'facebook', label: '📘 Facebook' },
  { value: 'referencia', label: '👤 Referência' },
  { value: 'outro', label: '◯ Outro' },
]

export function NewLeadModal({ onClose, onCreated, initialPerson, initialValues, defaultPipelineIds }: Props) {
  const [form, setForm] = useState({
    name: initialPerson?.name ?? '',
    email: initialPerson?.email ?? '',
    phone: initialPerson?.phone ?? '',
    source: 'site' as LeadSource,
    zone: initialValues?.zone ?? '',
    typology: initialValues?.typology ?? '',
    budget: initialValues?.budget != null ? String(initialValues.budget) : '',
    deal_value: '',
    expected_close_date: '',
    notes: '',
  })
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'manual' | 'audio'>('manual')

  // Campos de contacto — só usados para criar uma pessoa nova (quando
  // nenhuma pessoa é escolhida no autocomplete "Pessoa" abaixo). Mesmos
  // campos que o NewContactModal, via ContactFormFields.
  const [contactTypes, setContactTypes] = useState<ContactTypeKey[]>([])
  const [capacity, setCapacity] = useState('')
  const [contactSource, setContactSource] = useState('')
  const [details, setDetails] = useState<ContactDetails>({})
  const [assignedTo, setAssignedTo] = useState('')
  const [birthday, setBirthday] = useState('')
  const [isRegular, setIsRegular] = useState(false)
  const [members, setMembers] = useState<Member[]>([])

  const toggleContactType = (t: ContactTypeKey) =>
    setContactTypes(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))
  const setDetail = <K extends keyof ContactDetails>(k: K, v: ContactDetails[K]) =>
    setDetails(p => ({ ...p, [k]: v }))

  // Pipelines — seleção múltipla; cria uma lead por pipeline marcada.
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [pipelineIds, setPipelineIds] = useState<string[]>(defaultPipelineIds ?? [])
  const togglePipeline = (pid: string) =>
    setPipelineIds(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid])

  function applyVoice(f: Record<string, unknown>) {
    setForm(p => ({
      ...p,
      name: typeof f.name === 'string' ? f.name : p.name,
      email: typeof f.email === 'string' ? f.email : p.email,
      phone: typeof f.phone === 'string' ? f.phone : p.phone,
      zone: typeof f.zone === 'string' ? f.zone : p.zone,
      typology: typeof f.typology === 'string' ? f.typology : p.typology,
      budget: typeof f.budget === 'number' ? String(f.budget) : p.budget,
      notes: typeof f.notes === 'string' ? f.notes : p.notes,
    }))
    setMode('manual')
  }

  // Person autocomplete
  const [personSearch, setPersonSearch] = useState(initialPerson?.name ?? '')
  const [personResults, setPersonResults] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(initialPerson ?? null)
  const [showPersonDropdown, setShowPersonDropdown] = useState(false)
  const personRef = useRef<HTMLDivElement>(null)

  // Organization autocomplete
  const [orgSearch, setOrgSearch] = useState('')
  const [orgResults, setOrgResults] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [showOrgDropdown, setShowOrgDropdown] = useState(false)
  const orgRef = useRef<HTMLDivElement>(null)

  // Property autocomplete
  const [propSearch, setPropSearch] = useState('')
  const [propResults, setPropResults] = useState<Property[]>([])
  const [selectedProp, setSelectedProp] = useState<Property | null>(null)
  const [showPropDropdown, setShowPropDropdown] = useState(false)
  const propRef = useRef<HTMLDivElement>(null)

  const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-body)' }
  const labelStyle = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 5 }

  useEffect(() => {
    fetch('/api/custom-fields').then(r => r.json()).then(setCustomFields)
  }, [])

  useEffect(() => {
    fetch('/api/team/members')
      .then(r => r.ok ? r.json() : { members: [], current_user_id: '' })
      .then((data: { members: Member[]; current_user_id: string }) => {
        setMembers(data.members)
        setAssignedTo(prev => prev || data.current_user_id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/pipelines')
      .then(r => r.ok ? r.json() : [])
      .then((data: Pipeline[]) => {
        setPipelines(data)
        setPipelineIds(prev => prev.length > 0 ? prev : (data[0] ? [data[0].id] : []))
      })
      .catch(() => {})
  }, [])

  // Person search
  useEffect(() => {
    if (!personSearch || selectedPerson) { setPersonResults([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/people?search=${encodeURIComponent(personSearch)}`)
      if (res.ok) setPersonResults(await res.json())
    }, 300)
    return () => clearTimeout(timer)
  }, [personSearch, selectedPerson])

  // Organization search
  useEffect(() => {
    if (!orgSearch || selectedOrg) { setOrgResults([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/organizations?search=${encodeURIComponent(orgSearch)}`)
      if (res.ok) setOrgResults(await res.json())
    }, 300)
    return () => clearTimeout(timer)
  }, [orgSearch, selectedOrg])

  // Property search
  useEffect(() => {
    if (!propSearch || selectedProp) { setPropResults([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/properties?search=${encodeURIComponent(propSearch)}`)
      if (res.ok) setPropResults(await res.json())
    }, 300)
    return () => clearTimeout(timer)
  }, [propSearch, selectedProp])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (personRef.current && !personRef.current.contains(e.target as Node)) setShowPersonDropdown(false)
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setShowOrgDropdown(false)
      if (propRef.current && !propRef.current.contains(e.target as Node)) setShowPropDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pipelineIds.length === 0) return
    setLoading(true)
    try {
      const cfValues: Record<string, string | number | null> = {}
      for (const field of customFields) {
        const raw = customValues[field.id]
        if (!raw && field.required) return
        if (!raw) continue
        if (field.field_type === 'number' || field.field_type === 'currency') {
          cfValues[field.id] = Number(raw)
        } else {
          cfValues[field.id] = raw
        }
      }

      // Pessoa: usa a escolhida no autocomplete, ou cria uma nova com todos
      // os campos de ContactFormFields preenchidos neste mesmo passo.
      let personId = selectedPerson?.id ?? null
      if (!personId) {
        const personRes = await fetch('/api/people', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email || null,
            phone: form.phone || null,
            types: contactTypes,
            financial_capacity: (contactTypes.includes('comprador') || contactTypes.includes('investidor')) ? (capacity || null) : null,
            source: contactSource || null,
            details,
            notes: form.notes || null,
            birthday: birthday || null,
            is_regular: isRegular,
            assigned_to: assignedTo || null,
          }),
        })
        if (!personRes.ok) throw new Error('Erro ao criar contacto')
        const createdPerson = await personRes.json() as { id: string }
        personId = createdPerson.id
      }

      // Uma lead por pipeline marcada, todas ligadas à mesma pessoa/imóvel.
      const createdLeadIds: string[] = []
      for (const pipelineId of pipelineIds) {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email || null,
            phone: form.phone || null,
            source: form.source,
            zone: form.zone || null,
            typology: form.typology || null,
            budget: form.budget ? Number(form.budget) : null,
            deal_value: form.deal_value ? Number(form.deal_value) : null,
            expected_close_date: form.expected_close_date || null,
            notes: form.notes || null,
            person_id: personId,
            organization_id: selectedOrg?.id ?? null,
            property_id: selectedProp?.id ?? null,
            pipeline_id: pipelineId,
            custom_fields: Object.keys(cfValues).length > 0 ? cfValues : undefined,
          }),
        })
        if (!res.ok) throw new Error('Erro ao criar lead')
        const created = await res.json() as { id?: string }
        if (created?.id) createdLeadIds.push(created.id)
      }

      for (const leadId of createdLeadIds) {
        fetch('/api/ai/qualify-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: leadId }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(async (q: { score: number } | null) => {
            if (!q) return
            await fetch(`/api/leads/${leadId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ score: q.score }),
            })
          })
          .catch(() => {})
      }

      onCreated()
      onClose()
    } catch {
      // keep modal open on error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="font-display" style={{ fontSize: 18 }}>Novo Lead</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['manual', 'audio'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: mode === m ? 'var(--gold-glow)' : 'var(--surface)',
                color: mode === m ? 'var(--gold)' : 'var(--muted)',
                border: mode === m ? '1px solid var(--gold)' : '1px solid var(--border)',
              }}
            >
              {m === 'manual' ? '✍ Manual' : '🎙 Áudio'}
            </button>
          ))}
        </div>

        {mode === 'audio' && <AudioRecorder entity="lead" onExtracted={applyVoice} hint="Descreve o lead em voz alta (nome, contacto, zona, tipologia, orçamento e qualquer contexto extra) e confirma os dados a seguir." />}

        {mode === 'manual' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Person autocomplete */}
          <div ref={personRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Pessoa</label>
            {selectedPerson ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...inputStyle, background: 'var(--card)' }}>
                <span style={{ fontSize: 13, flex: 1 }}>{selectedPerson.name}</span>
                <button type="button" onClick={() => { setSelectedPerson(null); setPersonSearch('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            ) : (
              <input style={inputStyle} placeholder="Pesquisar pessoa..." value={personSearch} onChange={e => { setPersonSearch(e.target.value); setShowPersonDropdown(true) }} onFocus={() => setShowPersonDropdown(true)} />
            )}
            {showPersonDropdown && personSearch && !selectedPerson && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: 'auto', zIndex: 10 }}>
                {personResults.map(p => (
                  <div key={p.id} onClick={() => { setSelectedPerson(p); setPersonSearch(p.name); setShowPersonDropdown(false); setForm(f => ({ ...f, name: p.name, email: f.email || p.email || '', phone: f.phone || p.phone || '' })) }} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {p.email && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.email}</div>}
                  </div>
                ))}
                {personResults.length === 0 && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>Nenhuma pessoa encontrada</div>}
              </div>
            )}
          </div>

          {/* Organization autocomplete */}
          <div ref={orgRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Organização</label>
            {selectedOrg ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...inputStyle, background: 'var(--card)' }}>
                <span style={{ fontSize: 13, flex: 1 }}>{selectedOrg.name}</span>
                <button type="button" onClick={() => { setSelectedOrg(null); setOrgSearch('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            ) : (
              <input style={inputStyle} placeholder="Pesquisar organização..." value={orgSearch} onChange={e => { setOrgSearch(e.target.value); setShowOrgDropdown(true) }} onFocus={() => setShowOrgDropdown(true)} />
            )}
            {showOrgDropdown && orgSearch && !selectedOrg && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: 'auto', zIndex: 10 }}>
                {orgResults.map(o => (
                  <div key={o.id} onClick={() => { setSelectedOrg(o); setOrgSearch(o.name); setShowOrgDropdown(false) }} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 500 }}>{o.name}</div>
                  </div>
                ))}
                {orgResults.length === 0 && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>Nenhuma organização encontrada</div>}
              </div>
            )}
          </div>

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

          <div>
            <label style={labelStyle}>Nome *</label>
            <input
              style={{ ...inputStyle, ...(selectedPerson ? { background: 'var(--card)', color: 'var(--muted)' } : {}) }}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              disabled={!!selectedPerson}
              title={selectedPerson ? 'Nome do contacto ligado — edita-se na ficha do contacto' : undefined}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><label style={labelStyle}>Telefone</label><input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          </div>

          {!selectedPerson && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600 }}>Contacto</div>
              <ContactFormFields
                types={contactTypes} onToggleType={toggleContactType}
                capacity={capacity} onCapacityChange={setCapacity}
                source={contactSource} onSourceChange={setContactSource}
                details={details} onDetailChange={setDetail}
                assignedTo={assignedTo} onAssignedToChange={setAssignedTo} members={members}
                birthday={birthday} onBirthdayChange={setBirthday}
                isRegular={isRegular} onIsRegularChange={setIsRegular}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Zona</label><input style={inputStyle} value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} placeholder="Ex: Cascais" /></div>
            <div><label style={labelStyle}>Tipologia</label><input style={inputStyle} value={form.typology} onChange={e => setForm(p => ({ ...p, typology: e.target.value }))} placeholder="Ex: T3" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Orçamento (€)</label><input type="number" style={inputStyle} value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="Ex: 350000" /></div>
            <div>
              <label style={labelStyle}>Origem do negócio</label>
              <select style={{ ...inputStyle }} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value as LeadSource }))}>
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notas</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical' as const }}
              placeholder="Contexto adicional: familiares, profissão, motivo, preferências..."
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10, fontWeight: 600 }}>Negócio</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Valor do Negócio (€)</label><input type="number" style={inputStyle} value={form.deal_value} onChange={e => setForm(p => ({ ...p, deal_value: e.target.value }))} placeholder="Ex: 15000" /></div>
              <div><label style={labelStyle}>Data Prevista de Fecho</label><input type="date" style={inputStyle} value={form.expected_close_date} onChange={e => setForm(p => ({ ...p, expected_close_date: e.target.value }))} /></div>
            </div>
          </div>

          {customFields.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10, fontWeight: 600 }}>Campos Personalizados</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {customFields.map(field => (
                  <div key={field.id}>
                    <label style={labelStyle}>{field.name}{field.required ? ' *' : ''}</label>
                    {field.field_type === 'select' ? (
                      <select
                        style={inputStyle}
                        value={customValues[field.id] ?? ''}
                        onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                        required={field.required}
                      >
                        <option value="">Selecionar...</option>
                        {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.field_type === 'boolean' ? (
                      <select
                        style={inputStyle}
                        value={customValues[field.id] ?? ''}
                        onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                      >
                        <option value="">—</option>
                        <option value="true">Sim</option>
                        <option value="false">Nao</option>
                      </select>
                    ) : (
                      <input
                        type={field.field_type === 'number' || field.field_type === 'currency' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                        style={inputStyle}
                        value={customValues[field.id] ?? ''}
                        onChange={e => setCustomValues(p => ({ ...p, [field.id]: e.target.value }))}
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10, fontWeight: 600 }}>Pipelines</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {pipelines.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: pipelineIds.includes(p.id) ? 'var(--gold-glow)' : 'var(--surface)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={pipelineIds.includes(p.id)} onChange={() => togglePipeline(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
            {pipelineIds.length === 0 && <div style={{ fontSize: 11, color: '#B45309', marginTop: 6 }}>Marca pelo menos uma pipeline.</div>}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={loading || pipelineIds.length === 0} className="btn btn-primary" style={{ flex: 1 }}>
              {loading ? 'A criar...' : 'Criar Lead'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Atualizar `PipelineBoard.tsx`**

Trocar (linha 64):

```tsx
        <NewLeadModal pipelineId={selectedId} onClose={() => setShowNewLead(false)} onCreated={() => { setShowNewLead(false); if (selectedId) loadBoard(selectedId) }} />
```

por:

```tsx
        <NewLeadModal defaultPipelineIds={[selectedId]} onClose={() => setShowNewLead(false)} onCreated={() => { setShowNewLead(false); if (selectedId) loadBoard(selectedId) }} />
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. `app/(app)/leads/page.tsx` continua a chamar `<NewLeadModal onClose={...} onCreated={...} />` sem `defaultPipelineIds` — isso é válido porque a prop é opcional e o fallback interno (Step do `useEffect` de pipelines) escolhe a 1ª pipeline sozinho.

- [ ] **Step 4: Verificação manual**

Preview: no board da pipeline (`/pipeline`), abrir "+ Novo Lead" — confirmar que a pipeline atual já vem marcada nos checkboxes de "Pipelines", e que sem escolher pessoa existente aparecem todos os campos de contacto (tipo, detalhes, etc.) incluindo o link Idealista. Criar uma lead marcando 2 pipelines e confirmar que aparece nas duas (trocar de aba de pipeline no board). Depois, criar outra lead escolhendo uma pessoa já existente no autocomplete "Pessoa" e confirmar que o campo "Nome" fica bloqueado (cinzento, não editável) e que a secção de contacto não aparece.

- [ ] **Step 5: Commit**

```bash
git add components/leads/NewLeadModal.tsx components/pipeline/PipelineBoard.tsx
git commit -m "feat: unify NewLeadModal with ContactFormFields and multi-pipeline selection"
```

---

### Task 4: "+ Pipeline" com seleção múltipla no `ContactDetailPanel`

**Files:**
- Modify: `components/contacts/ContactDetailPanel.tsx`

- [ ] **Step 1: Adicionar estado de seleção**

A seguir à linha `const [pipelineMenuOpen, setPipelineMenuOpen] = useState(false)` (linha 54), adicionar:

```tsx
  const [pipelineSelection, setPipelineSelection] = useState<string[]>([])
```

- [ ] **Step 2: Substituir `addToPipeline` por `addToPipelines`**

Trocar a função `addToPipeline` (linhas 208-221) por:

```tsx
  async function addToPipelines(pipelineIds: string[]) {
    if (pipelineIds.length === 0) return
    setPipelineBusy(true)
    setPipelineMenuOpen(false)
    try {
      for (const pipelineId of pipelineIds) {
        await fetch(`/api/people/${id}/pipeline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pipeline_id: pipelineId }),
        })
      }
      fetchPerson(); onChanged?.()
    } finally {
      setPipelineBusy(false)
      setPipelineSelection([])
    }
  }
```

- [ ] **Step 3: Trocar o menu de uma pipeline de cada vez por checkboxes**

Trocar o bloco (linhas 338-344):

```tsx
              {pipelineMenuOpen && (
                <div className="card" style={{ position: 'absolute', top: '110%', right: 0, zIndex: 30, minWidth: 180, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, boxShadow: 'var(--shadow-md)' }}>
                  {missingPipelines.map(p => (
                    <button key={p.id} onClick={() => addToPipeline(p.id)} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}>{p.name}</button>
                  ))}
                </div>
              )}
```

por:

```tsx
              {pipelineMenuOpen && (
                <div className="card" style={{ position: 'absolute', top: '110%', right: 0, zIndex: 30, minWidth: 200, padding: 10, display: 'flex', flexDirection: 'column', gap: 4, boxShadow: 'var(--shadow-md)' }}>
                  {missingPipelines.map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={pipelineSelection.includes(p.id)}
                        onChange={() => setPipelineSelection(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                      />
                      {p.name}
                    </label>
                  ))}
                  <button
                    type="button"
                    disabled={pipelineSelection.length === 0}
                    onClick={() => addToPipelines(pipelineSelection)}
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 6 }}
                  >
                    Adicionar
                  </button>
                </div>
              )}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Verificação manual**

Preview: abrir a ficha de um contacto que ainda não está em nenhuma pipeline (ou remover de todas primeiro), clicar "+ Pipeline", marcar duas pipelines nos checkboxes, clicar "Adicionar" — confirmar que aparecem 2 entradas em "Negócios ativos".

- [ ] **Step 6: Commit**

```bash
git add components/contacts/ContactDetailPanel.tsx
git commit -m "feat: allow selecting multiple pipelines at once from contact panel"
```

---

### Task 5: Eliminar pipeline sem bloqueio

**Files:**
- Modify: `app/api/pipelines/[id]/route.ts`

- [ ] **Step 1: Substituir o bloqueio por eliminação em cascata**

No `DELETE`, trocar este bloco:

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

  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', id)
    .eq('agency_id', profile.agency_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
```

por:

```ts
  // As leads desta pipeline são apagadas antes da pipeline em si — o FK de
  // leads.stage_id impede o cascade normal de pipeline_stages. Isto só apaga
  // a ligação à pipeline: people/organizations/properties nunca são tocados
  // (todos os FKs lead_id no schema são ON DELETE CASCADE — activities,
  // tasks, contacts, automation_logs, etc. — por isso isto é seguro).
  const { error: leadsError } = await supabase
    .from('leads')
    .delete()
    .eq('pipeline_id', id)
    .eq('agency_id', profile.agency_id)
  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })

  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', id)
    .eq('agency_id', profile.agency_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
```

(A validação anterior no mesmo handler, que impede eliminar a última pipeline da agência, mantém-se inalterada — não mexer nessa parte.)

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificação manual**

Preview: criar uma pipeline de teste, adicionar 1-2 leads, eliminar a pipeline pelo 🗑️ no board — confirmar que desaparece sem alerta de bloqueio, e que os contactos dessas leads continuam intactos em `/people`.

- [ ] **Step 4: Commit**

```bash
git add "app/api/pipelines/[id]/route.ts"
git commit -m "fix: allow deleting a pipeline that still has leads"
```

---

### Task 6: Nome do contacto desatualizado no card do Kanban

**Files:**
- Modify: `components/pipeline/KanbanBoard.tsx`

- [ ] **Step 1: Corrigir `cardFieldValue`**

Trocar:

```ts
    case 'name': return lead.name
```

por:

```ts
    // O contacto ligado é a fonte da verdade para o nome — lead.name é só
    // uma cópia guardada na criação, que fica desatualizada se o contacto
    // for renomeado depois.
    case 'name': return lead.people?.name ?? lead.name
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificação manual**

Preview: abrir um contacto ligado a uma lead no board, editar o nome em `/people/{id}`, voltar ao board (ou fechar/reabrir o slide-over) — confirmar que o card mostra o nome novo.

- [ ] **Step 4: Commit**

```bash
git add components/pipeline/KanbanBoard.tsx
git commit -m "fix: pipeline card shows the contact's current name instead of a stale copy"
```

---

### Task 7: Link Idealista — Contacto e Imóvel

**Files:**
- Modify: `components/contacts/ContactDetailPanel.tsx`
- Modify: `app/(app)/properties/page.tsx`
- Modify: `app/(app)/properties/[id]/page.tsx`

- [ ] **Step 1: Campo Idealista no `ContactDetailPanel`**

Antes do bloco `<div className="card" style={{ padding: 24 }}>{cardTitle('Notas')}` (linha 576), adicionar um card novo, sempre visível (fora dos blocos condicionais de tipo):

```tsx
            <div className="card" style={{ padding: 24 }}>
              {cardTitle('Idealista')}
              {field('Link do anúncio', fieldValue(d.idealista_url), <input className="input" value={d.idealista_url ?? ''} onChange={e => setDetail('idealista_url', e.target.value)} />)}
            </div>

```

- [ ] **Step 2: Campo Idealista no formulário de criação de imóvel**

Em `app/(app)/properties/page.tsx`, adicionar `idealista_url: ''` ao `emptyForm` (a seguir a `notes: '',`):

```tsx
    description: '', notes: '', features: '', photos: '', idealista_url: '',
```

No `createProperty`, adicionar ao body do `fetch`, a seguir a `notes: form.notes || null,`:

```tsx
          notes: form.notes || null,
          idealista_url: form.idealista_url || null,
```

Na JSX do formulário, a seguir ao bloco de "Fotos (opcional)" (a seguir ao `<textarea ... placeholder="URLs das fotos, uma por linha" ...`, antes da `<div style={{ display: 'flex', gap: 10, marginTop: 4 }}>` dos botões), adicionar:

```tsx
              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Idealista</div>
              <input className="input" placeholder="Link do anúncio (https://www.idealista.pt/imovel/...)" value={form.idealista_url} onChange={e => setForm(p => ({ ...p, idealista_url: e.target.value }))} />
```

- [ ] **Step 3: Campo Idealista na ficha do imóvel**

Em `app/(app)/properties/[id]/page.tsx`, adicionar `idealista_url: ''` ao `useState` inicial do `form` (linha 68-73, a seguir a `photos: ''`):

```tsx
    description: '', notes: '', features: '', photos: '', idealista_url: ''
```

No `fetchProperty`, adicionar ao `setForm` (a seguir a `photos: (data.photos ?? []).join('\n'),`):

```tsx
      photos: (data.photos ?? []).join('\n'),
      idealista_url: data.idealista_url ?? '',
```

No `save()`, adicionar ao body do `fetch` (a seguir a `notes: form.notes || null,`):

```tsx
        notes: form.notes || null,
        idealista_url: form.idealista_url || null,
```

Na JSX, a seguir ao bloco de Notas (linhas 307-310, dentro do mesmo `div` de detalhes à esquerda), adicionar:

```tsx
            <div style={{ marginTop: 12 }}>
              <div style={labelStyle}>Link Idealista</div>
              {editing ? <input style={inputStyle} value={form.idealista_url} onChange={e => setForm(p => ({ ...p, idealista_url: e.target.value }))} placeholder="https://www.idealista.pt/imovel/..." /> : (
                property.idealista_url ? <a href={property.idealista_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--gold)' }}>{property.idealista_url}</a> : <div style={{ fontSize: 13, color: 'var(--muted)' }}>—</div>
              )}
            </div>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Verificação manual**

Preview: criar um imóvel novo com link Idealista preenchido, confirmar que persiste ao abrir a ficha; editar o link de um imóvel existente e guardar; preencher e guardar o link Idealista num contacto em `/people/{id}`.

- [ ] **Step 6: Commit**

```bash
git add components/contacts/ContactDetailPanel.tsx "app/(app)/properties/page.tsx" "app/(app)/properties/[id]/page.tsx"
git commit -m "feat: add Idealista listing link field to contacts and properties"
```

---

### Task 8: Verificação final

- [ ] **Step 1: Build completo**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros em nenhum dos dois comandos.

- [ ] **Step 2: Checklist de verificação manual (spec, secção "Testes / verificação")**

No preview do browser, percorrer cada item:
- Criar um lead novo sem escolher pessoa existente: preencher tipo (vendedor), zona/preço de venda, link Idealista, marcar 2 pipelines → confirmar 2 leads criadas (uma por pipeline) e um contacto novo em `/people` com esses dados.
- Criar um lead escolhendo uma pessoa já existente → confirmar que os campos de tipo/detalhes não aparecem e que o campo Nome fica bloqueado ao nome da pessoa.
- Editar o nome de um contacto em `/people/{id}`, voltar ao board → confirmar que o card mostra o nome novo.
- Eliminar uma pipeline com leads → confirmar que apaga sem bloqueio e que os contactos continuam intactos em `/people`.
- Adicionar um contacto existente a 2 pipelines de uma vez via checkboxes no "+ Pipeline".
- Preencher e guardar o link Idealista num contacto e num imóvel, confirmar persistência ao recarregar.
- Remover um contacto de uma pipeline via painel lateral → confirmar que o contacto e o histórico continuam intactos.

- [ ] **Step 3: Commit final (se houver ajustes da verificação)**

Só se algum passo acima tiver exigido correções não cobertas pelas tasks anteriores.
