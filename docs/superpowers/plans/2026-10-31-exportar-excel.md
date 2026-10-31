# Exportar contactos para Excel — Plano de implementação

> **Para agentes:** executar tarefa a tarefa com superpowers:executing-plans. Os passos usam checkbox (`- [ ]`).

**Objetivo:** criar a página `/exportar`, onde se escolhe pipeline e fases, se reveem os contactos e se descarrega um `.xlsx`.

**Arquitetura:** uma função no servidor carrega as linhas e aplica permissões e agrupamento. A rota usa-a tanto para a pré-visualização como para o ficheiro. A página é um cliente fino sobre essa rota.

**Stack:** Next.js 16 (route handlers com `Request`/`Response`), Supabase, ExcelJS, React 19.

**Spec:** `docs/superpowers/specs/2026-10-31-exportar-excel-design.md`

**Testes:** o projeto não tem suite de testes, por isso cada tarefa fecha com verificação de tipos e a Tarefa 6 faz a verificação completa no preview.

---

## Ficheiros

| Ficheiro | Responsabilidade |
|---|---|
| `lib/exports/contacts.ts` | Carregar e agrupar linhas, aplicar permissões |
| `lib/exports/build-workbook.ts` | Transformar linhas num `.xlsx` |
| `app/api/exports/contacts/route.ts` | Pré-visualização (GET) e ficheiro (POST) |
| `app/(app)/exportar/page.tsx` | Filtros, lista e botão |
| `components/layout/SidebarNav.tsx`, `TopNav.tsx`, `MobileNav.tsx`, `components/CommandPalette.tsx` | Entradas de navegação |
| `app/(app)/leads/page.tsx` | Botão "Exportar" liga à nova página |

---

### Tarefa 1: Carregar as linhas

- [ ] **Passo 1: Instalar a dependência**

```bash
npm install exceljs@4.4.0
```

- [ ] **Passo 2: Criar o módulo**

Ficheiro: `lib/exports/contacts.ts`

```ts
import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

export const NO_TEMPERATURE = 'sem'
export const TEMPERATURE_FILTERS = ['frio', 'fresco', 'morno', 'quente', NO_TEMPERATURE] as const

export type ExportFilters = {
  pipelineId: string
  stageIds: string[]
  temperature: string | null
}

export type ExportViewer = {
  userId: string
  agencyId: string
  role: string
}

export type ExportRow = {
  key: string
  name: string
  phone: string | null
  email: string | null
  pipeline: string
  stage: string
  temperature: string | null
  consultant: string | null
  property: string | null
  lastContactAt: string | null
}

type LeadRow = {
  id: string
  person_id: string | null
  name: string
  email: string | null
  phone: string | null
  users: { name: string } | null
  pipeline_stages: { name: string } | null
  pipelines: { name: string } | null
  people: { name: string; email: string | null; phone: string | null; temperature: string | null } | null
  properties: { reference: string | null; title: string | null } | null
}

const LEAD_SELECT = 'id, person_id, name, email, phone, users(name), pipeline_stages(name), pipelines(name), people(name, email, phone, temperature), properties(reference, title)'
const PAGE_SIZE = 1000
const CHUNK_SIZE = 200

// O Supabase devolve no máximo 1000 linhas por query. Mais recentes primeiro:
// é a lead mais recente que representa o contacto quando há repetidos.
async function fetchLeads(supabase: Supabase, viewer: ExportViewer, filters: ExportFilters): Promise<LeadRow[]> {
  const leads: LeadRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from('leads')
      .select(LEAD_SELECT)
      .eq('agency_id', viewer.agencyId)
      .eq('pipeline_id', filters.pipelineId)
      .in('stage_id', filters.stageIds)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (viewer.role === 'agent') query = query.eq('assigned_to', viewer.userId)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    leads.push(...(data as unknown as LeadRow[]))
    if (data.length < PAGE_SIZE) return leads
  }
}

// Só chamadas atendidas contam como contacto, a mesma regra da contagem de
// dias desde o último contacto.
async function fetchLastContacts(supabase: Supabase, personIds: string[]): Promise<Map<string, string>> {
  const lastContacts = new Map<string, string>()
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('contact_interactions')
      .select('person_id, created_at')
      .eq('type', 'chamada')
      .eq('outcome', 'atendeu')
      .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    for (const c of data) {
      if (!lastContacts.has(c.person_id)) lastContacts.set(c.person_id, c.created_at)
    }
  }
  return lastContacts
}

function propertyLabel(property: LeadRow['properties']): string | null {
  if (!property) return null
  return [property.reference, property.title].filter(Boolean).join(' — ') || null
}

export async function loadExportRows(supabase: Supabase, viewer: ExportViewer, filters: ExportFilters): Promise<ExportRow[]> {
  const leads = await fetchLeads(supabase, viewer, filters)

  const byKey = new Map<string, LeadRow>()
  for (const lead of leads) {
    const key = lead.person_id ? `p:${lead.person_id}` : `l:${lead.id}`
    if (!byKey.has(key)) byKey.set(key, lead)
  }

  const personIds = [...byKey.values()].map(l => l.person_id).filter((v): v is string => !!v)
  const lastContacts = await fetchLastContacts(supabase, personIds)

  const rows = [...byKey.entries()].map(([key, lead]): ExportRow => ({
    key,
    name: lead.people?.name || lead.name,
    phone: lead.people?.phone || lead.phone,
    email: lead.people?.email || lead.email,
    pipeline: lead.pipelines?.name ?? '',
    stage: lead.pipeline_stages?.name ?? '',
    temperature: lead.people?.temperature ?? null,
    consultant: lead.users?.name ?? null,
    property: propertyLabel(lead.properties),
    lastContactAt: lead.person_id ? lastContacts.get(lead.person_id) ?? null : null,
  }))

  return rows
    .filter(row => {
      if (!filters.temperature) return true
      if (filters.temperature === NO_TEMPERATURE) return !row.temperature
      return row.temperature === filters.temperature
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
}
```

- [ ] **Passo 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Passo 4: Commit**

```bash
git add package.json package-lock.json lib/exports/contacts.ts
git commit -m "feat: carregar contactos para exportação"
```

---

### Tarefa 2: Gerar o ficheiro

- [ ] **Passo 1: Criar o módulo**

Ficheiro: `lib/exports/build-workbook.ts`

```ts
import ExcelJS from 'exceljs'
import type { ExportRow } from './contacts'

const COLUMNS: { header: string; width: number; value: (row: ExportRow) => string }[] = [
  { header: 'Nome', width: 30, value: r => r.name },
  { header: 'Telefone', width: 18, value: r => r.phone ?? '' },
  { header: 'Email', width: 32, value: r => r.email ?? '' },
  { header: 'Pipeline', width: 20, value: r => r.pipeline },
  { header: 'Fase', width: 26, value: r => r.stage },
  { header: 'Temperatura', width: 14, value: r => r.temperature ? r.temperature[0].toUpperCase() + r.temperature.slice(1) : '' },
  { header: 'Consultor', width: 22, value: r => r.consultant ?? '' },
  { header: 'Imóvel', width: 34, value: r => r.property ?? '' },
  { header: 'Último contacto', width: 16, value: r => r.lastContactAt ? new Date(r.lastContactAt).toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' }) : '' },
]

// Tudo entra como texto: mantém o «+351» e o Excel não interpreta nada como fórmula.
export async function buildContactsWorkbook(rows: ExportRow[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Contactos', { views: [{ state: 'frozen', ySplit: 1 }] })

  sheet.columns = COLUMNS.map(c => ({ header: c.header, width: c.width }))
  sheet.getRow(1).font = { bold: true }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } }
  for (const row of rows) sheet.addRow(COLUMNS.map(c => c.value(row)))

  return await workbook.xlsx.writeBuffer() as unknown as ArrayBuffer
}
```

- [ ] **Passo 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Passo 3: Commit**

```bash
git add lib/exports/build-workbook.ts
git commit -m "feat: gerar o ficheiro Excel dos contactos"
```

---

### Tarefa 3: Rota da API

- [ ] **Passo 1: Criar a rota**

Ficheiro: `app/api/exports/contacts/route.ts`

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildContactsWorkbook } from '@/lib/exports/build-workbook'
import { loadExportRows, TEMPERATURE_FILTERS, type ExportFilters } from '@/lib/exports/contacts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseFilters(pipelineId: unknown, stageIds: unknown, temperature: unknown): ExportFilters | null {
  if (typeof pipelineId !== 'string' || !UUID.test(pipelineId)) return null
  if (!Array.isArray(stageIds) || stageIds.length === 0) return null
  if (!stageIds.every(id => typeof id === 'string' && UUID.test(id))) return null
  if (temperature && !(TEMPERATURE_FILTERS as readonly unknown[]).includes(temperature)) return null
  return { pipelineId, stageIds, temperature: temperature ? String(temperature) : null }
}

// Sessão, perfil e pipeline da própria agência: comum à pré-visualização e ao ficheiro.
async function authorize(pipelineId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { failure: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('users')
    .select('role, agency_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { failure: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id, name')
    .eq('id', pipelineId)
    .eq('agency_id', profile.agency_id)
    .single()
  if (!pipeline) return { failure: NextResponse.json({ error: 'Pipeline inválida' }, { status: 404 }) }

  return { supabase, pipeline, viewer: { userId: user.id, agencyId: profile.agency_id, role: profile.role } }
}

function exportFileName(pipelineName: string): string {
  const slug = pipelineName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
  return `contactos-${slug || 'pipeline'}-${today}.xlsx`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filters = parseFilters(
    searchParams.get('pipeline_id'),
    searchParams.get('stage_ids')?.split(',').filter(Boolean),
    searchParams.get('temperature'),
  )
  if (!filters) return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })

  const auth = await authorize(filters.pipelineId)
  if (auth.failure) return auth.failure

  try {
    return NextResponse.json(await loadExportRows(auth.supabase, auth.viewer, filters))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao carregar contactos' }, { status: 500 })
  }
}

// As linhas são recarregadas pelos filtros e só depois cortadas pelas chaves
// escolhidas: o cliente não consegue pedir contactos que não possa ver, e quem
// entrou na fase depois da pré-visualização não sai sem ser visto.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const filters = parseFilters(body.pipeline_id, body.stage_ids, body.temperature)
  const selectedKeys = Array.isArray(body.selected_keys) ? new Set(body.selected_keys) : new Set()
  if (!filters || selectedKeys.size === 0) return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })

  const auth = await authorize(filters.pipelineId)
  if (auth.failure) return auth.failure

  try {
    const rows = await loadExportRows(auth.supabase, auth.viewer, filters)
    const file = await buildContactsWorkbook(rows.filter(r => selectedKeys.has(r.key)))
    return new Response(file, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${exportFileName(auth.pipeline.name)}"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao gerar o ficheiro' }, { status: 500 })
  }
}
```

- [ ] **Passo 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Passo 3: Commit**

```bash
git add app/api/exports/contacts/route.ts
git commit -m "feat: rota de pré-visualização e ficheiro da exportação"
```

---

### Tarefa 4: Página

- [ ] **Passo 1: Criar a página**

Ficheiro: `app/(app)/exportar/page.tsx`

```tsx
'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pipeline, PipelineStage } from '@/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import type { ExportRow } from '@/lib/exports/contacts'

const TEMPERATURE_OPTIONS = [
  { value: '', label: 'Todas as temperaturas' },
  { value: 'frio', label: 'Frio' },
  { value: 'fresco', label: 'Fresco' },
  { value: 'morno', label: 'Morno' },
  { value: 'quente', label: 'Quente' },
  { value: 'sem', label: 'Sem temperatura' },
]

function formatDate(date: string | null): string {
  return date ? new Date(date).toLocaleDateString('pt-PT') : '—'
}

export default function ExportarPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [pipelineId, setPipelineId] = useState('')
  const [stageIds, setStageIds] = useState<string[]>([])
  const [temperature, setTemperature] = useState('')
  const [rows, setRows] = useState<ExportRow[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/pipelines').then(r => r.ok ? r.json() : []).then(setPipelines).catch(() => {})
    fetch('/api/pipeline-stages').then(r => r.ok ? r.json() : []).then(setStages).catch(() => {})
  }, [])

  const loadRows = useCallback(async (ignored: () => boolean) => {
    const params = new URLSearchParams({ pipeline_id: pipelineId, stage_ids: stageIds.join(',') })
    if (temperature) params.set('temperature', temperature)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exports/contacts?${params}`)
      if (!res.ok) throw new Error()
      const data: ExportRow[] = await res.json()
      if (ignored()) return
      setRows(data)
      setExcluded(new Set())
    } catch {
      if (ignored()) return
      setRows([])
      setError('Não foi possível carregar os contactos.')
    } finally {
      if (!ignored()) setLoading(false)
    }
  }, [pipelineId, stageIds, temperature])

  useEffect(() => {
    if (stageIds.length === 0) return
    let stale = false
    loadRows(() => stale)
    return () => { stale = true }
  }, [loadRows, stageIds])

  function selectPipeline(id: string) {
    setPipelineId(id)
    setStageIds([])
    setRows([])
    setExcluded(new Set())
  }

  function toggleStage(id: string) {
    const next = stageIds.includes(id) ? stageIds.filter(s => s !== id) : [...stageIds, id]
    setStageIds(next)
    if (next.length === 0) setRows([])
  }

  function toggleRow(key: string) {
    setExcluded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(r => [r.name, r.phone, r.email].some(v => v?.toLowerCase().includes(term)))
  }, [rows, search])

  const selectedRows = rows.filter(r => !excluded.has(r.key))
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every(r => !excluded.has(r.key))

  // Só mexe nos contactos à vista: com a pesquisa ativa, os outros mantêm-se como estão.
  function toggleAllVisible() {
    setExcluded(prev => {
      const next = new Set(prev)
      for (const r of visibleRows) {
        if (allVisibleSelected) next.add(r.key)
        else next.delete(r.key)
      }
      return next
    })
  }

  async function createExcel() {
    setDownloading(true)
    setError(null)
    try {
      const res = await fetch('/api/exports/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_id: pipelineId,
          stage_ids: stageIds,
          temperature: temperature || null,
          selected_keys: selectedRows.map(r => r.key),
        }),
      })
      if (!res.ok) throw new Error()
      const url = URL.createObjectURL(await res.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'contactos.xlsx'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Não foi possível criar o Excel. Tenta de novo.')
    } finally {
      setDownloading(false)
    }
  }

  const pipelineStages = stages.filter(s => s.pipeline_id === pipelineId)
  const withoutEmail = selectedRows.filter(r => !r.email).length
  const withoutPhone = selectedRows.filter(r => !r.phone).length

  return (
    <div className="page-enter" style={{ padding: 'var(--space-6) var(--space-8)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-6)', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="font-display" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.1 }}>Exportar Excel</h1>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 'var(--space-1)' }}>
            {rows.length > 0
              ? `${selectedRows.length} selecionados · ${withoutEmail} sem email · ${withoutPhone} sem telefone`
              : 'Escolhe a pipeline e as fases dos contactos a exportar.'}
          </p>
        </div>
        <button onClick={createExcel} disabled={selectedRows.length === 0 || loading || downloading} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <Icon name="download" size={14} />
          {downloading ? 'A criar...' : `Criar Excel (${selectedRows.length} contactos)`}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <select className="input" value={pipelineId} onChange={e => selectPipeline(e.target.value)} style={{ width: 'auto', minWidth: 200, background: 'var(--surface)' }} aria-label="Pipeline">
          <option value="">Escolher pipeline</option>
          {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input" value={temperature} onChange={e => setTemperature(e.target.value)} style={{ width: 'auto', minWidth: 200, background: 'var(--surface)' }} aria-label="Temperatura">
          {TEMPERATURE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {rows.length > 0 && (
          <div style={{ flex: '1 1 240px', maxWidth: 400, position: 'relative' }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input placeholder="Pesquisar na lista..." value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ width: '100%', paddingLeft: 34, background: 'var(--surface)' }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        {pipelineStages.map(s => {
          const active = stageIds.includes(s.id)
          return (
            <button
              key={s.id}
              onClick={() => toggleStage(s.id)}
              aria-pressed={active}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                background: active ? 'var(--gold)' : 'transparent',
                color: active ? 'white' : 'var(--muted)',
                border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                transition: 'all 0.15s var(--ease)',
              }}
            >
              {s.name}
            </button>
          )
        })}
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-base)', marginBottom: 'var(--space-4)' }}>{error}</p>}

      <div className="card" style={{ overflow: 'hidden' }}>
        {stageIds.length === 0 ? (
          <EmptyState illustration="search" title="Escolhe as fases" description="Os contactos aparecem aqui depois de escolheres a pipeline e pelo menos uma fase." />
        ) : !loading && rows.length === 0 ? (
          <EmptyState illustration="search" title="Nenhum contacto nestes filtros" description="Experimenta outras fases ou outra temperatura." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="table-header">
                <th style={{ width: 40 }}>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Selecionar todos" />
                </th>
                <th>Contacto</th>
                <th>Telefone</th>
                <th className="hide-mobile">Fase</th>
                <th className="hide-mobile">Consultor</th>
                <th className="hide-mobile">Último contacto</th>
              </tr>
            </thead>
            <tbody>
              {loading && [0, 1, 2, 3].map(i => (
                <tr key={i}>
                  <td colSpan={6} style={{ padding: '8px 20px' }}><div className="skeleton" style={{ height: 34 }} /></td>
                </tr>
              ))}
              {!loading && visibleRows.map(row => (
                <tr key={row.key} className="table-row" style={{ cursor: 'pointer' }} onClick={() => toggleRow(row.key)}>
                  <td>
                    <input type="checkbox" checked={!excluded.has(row.key)} onChange={() => toggleRow(row.key)} onClick={e => e.stopPropagation()} aria-label={`Exportar ${row.name}`} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{row.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{row.email ?? 'Sem email'}</div>
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{row.phone ?? '—'}</td>
                  <td className="hide-mobile" style={{ color: 'var(--muted)', fontSize: 12 }}>{row.stage}</td>
                  <td className="hide-mobile" style={{ color: 'var(--muted)', fontSize: 12 }}>{row.consultant ?? '—'}</td>
                  <td className="hide-mobile" style={{ color: 'var(--muted)', fontSize: 12 }}>{formatDate(row.lastContactAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Passo 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Passo 3: Commit**

```bash
git add "app/(app)/exportar/page.tsx"
git commit -m "feat: página de exportação para Excel"
```

---

### Tarefa 5: Navegação

- [ ] **Passo 1: Acrescentar as entradas depois de "Relatórios"**

Em `components/layout/SidebarNav.tsx` e `components/layout/TopNav.tsx`, depois da linha de `/reports`:

```ts
  { href: '/exportar', icon: 'download', label: 'Exportar Excel' },
```

Em `components/layout/MobileNav.tsx`, a mesma linha em `moreItems`, depois de `/reports`.

Em `components/CommandPalette.tsx`, depois de `/reports`:

```ts
  { label: 'Exportar Excel', href: '/exportar', icon: 'download', keywords: 'excel exportar contactos lista xlsx' },
```

- [ ] **Passo 2: Ligar o botão da página Leads**

Em `app/(app)/leads/page.tsx`, trocar `<button onClick={() => {}} className="btn btn-ghost"` por:

```tsx
<button onClick={() => router.push('/exportar')} className="btn btn-ghost"
```

- [ ] **Passo 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Passo 4: Commit**

```bash
git add components "app/(app)/leads/page.tsx"
git commit -m "feat: ligar a exportação à navegação"
```

---

### Tarefa 6: Verificação

- [ ] **Passo 1: Lint e build**

Run: `npm run lint && npm run build`
Expected: sem erros nos ficheiros novos. Se o build falhar com a ExcelJS, acrescentar `serverExternalPackages: ['exceljs']` a `next.config.ts`.

- [ ] **Passo 2: Verificar no preview**

Copiar `.env.local` da checkout principal se faltar e arrancar o servidor com `preview_start`. Confirmar a lista de verificação da spec: admin, consultor, contactos repetidos, telefones `+351` e largura de telemóvel. O conteúdo do `.xlsx` verifica-se abrindo o ficheiro gerado com a ExcelJS num script no scratchpad.

- [ ] **Passo 3: Commit de eventuais correções**

```bash
git add -A
git commit -m "fix: correções da verificação da exportação"
```
