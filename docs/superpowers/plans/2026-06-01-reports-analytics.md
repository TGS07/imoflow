# Relatórios/Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma página de relatórios em `/reports` com 4 KPIs e 4 gráficos interativos filtráveis por período.

**Architecture:** API route `/api/reports?period=30d` executa queries Supabase em paralelo e devolve todos os dados num único request. Página client-side com Recharts renderiza KPI cards e gráficos. Sem novas tabelas na BD.

**Tech Stack:** Next.js 15, Supabase, TypeScript, Recharts

---

## Estrutura de Ficheiros

| Ficheiro | Ação | Responsabilidade |
|---------|------|-----------------|
| `types/reports.ts` | Criar | Tipos TypeScript para ReportsData e sub-tipos |
| `types/index.ts` | Modificar | Re-exportar novos tipos |
| `app/api/reports/route.ts` | Criar | GET endpoint que devolve todos os dados de relatórios |
| `app/(app)/reports/page.tsx` | Criar | Página client-side com KPIs e gráficos |
| `components/layout/Sidebar.tsx` | Modificar | Adicionar link Relatórios |

---

## Task 1: Instalar Recharts e criar tipos

**Files:**
- Modify: `package.json` (via npm)
- Create: `types/reports.ts`
- Modify: `types/index.ts`

- [ ] **Step 1: Instalar recharts**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npm install recharts
```

Esperado: recharts adicionado ao `package.json` sem erros.

- [ ] **Step 2: Criar `types/reports.ts`**

```typescript
export type ReportPeriod = '30d' | '90d' | '6m' | '1y'

export type ReportsKpis = {
  total_leads: number
  won_leads: number
  conversion_rate: number  // percentagem 0-100, arredondada a 1 decimal
  pipeline_value: number
  avg_close_days: number | null
}

export type FunnelItem = {
  stage_id: string
  name: string
  position: number
  count: number
}

export type SourceItem = {
  source: string
  count: number
}

export type TimeItem = {
  week: string  // ISO date string da segunda-feira da semana
  count: number
}

export type AgentItem = {
  user_id: string
  name: string
  won_count: number
}

export type ReportsData = {
  kpis: ReportsKpis
  funnel: FunnelItem[]
  by_source: SourceItem[]
  over_time: TimeItem[]
  by_agent: AgentItem[]
}
```

- [ ] **Step 3: Adicionar re-export em `types/index.ts`**

Adicionar no final do ficheiro:

```typescript
export type { ReportPeriod, ReportsKpis, FunnelItem, SourceItem, TimeItem, AgentItem, ReportsData } from './reports'
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json types/reports.ts types/index.ts
git commit -m "feat: install recharts and add reports TypeScript types"
```

---

## Task 2: API Route de Relatórios

**Files:**
- Create: `app/api/reports/route.ts`

- [ ] **Step 1: Criar `app/api/reports/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ReportsData, ReportPeriod } from '@/types'

function getCutoff(period: ReportPeriod): string {
  const now = new Date()
  switch (period) {
    case '30d': now.setDate(now.getDate() - 30); break
    case '90d': now.setDate(now.getDate() - 90); break
    case '6m': now.setMonth(now.getMonth() - 6); break
    case '1y': now.setFullYear(now.getFullYear() - 1); break
  }
  return now.toISOString()
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = (searchParams.get('period') ?? '30d') as ReportPeriod
  const cutoff = getCutoff(period)

  // Todas as queries em paralelo
  const [
    leadsResult,
    funnelResult,
    sourceResult,
    timeResult,
    agentResult,
  ] = await Promise.all([
    // KPIs: total, won, pipeline_value
    supabase
      .from('leads')
      .select('id, deal_value, pipeline_stages(is_won, is_lost)')
      .gte('created_at', cutoff),

    // Funil: leads por stage
    supabase
      .from('pipeline_stages')
      .select('id, name, position, leads(id)')
      .order('position', { ascending: true }),

    // Por fonte
    supabase
      .from('leads')
      .select('source')
      .gte('created_at', cutoff),

    // Ao longo do tempo (últimas semanas)
    supabase
      .from('leads')
      .select('created_at')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true }),

    // Por agente (leads ganhas)
    supabase
      .from('leads')
      .select('assigned_to, users(id, name), pipeline_stages(is_won)')
      .gte('created_at', cutoff)
      .not('assigned_to', 'is', null),
  ])

  // --- KPIs ---
  const leads = leadsResult.data ?? []
  const totalLeads = leads.length
  const wonLeads = leads.filter(l => {
    const ps = l.pipeline_stages as unknown as { is_won: boolean } | null
    return ps?.is_won === true
  })
  const wonCount = wonLeads.length
  const conversionRate = totalLeads > 0
    ? Math.round((wonCount / totalLeads) * 1000) / 10
    : 0

  const pipelineValue = leads.reduce((sum, l) => {
    const ps = l.pipeline_stages as unknown as { is_lost: boolean } | null
    if (ps?.is_lost) return sum
    return sum + (Number(l.deal_value) || 0)
  }, 0)

  // avg_close_days: aproximamos com updated_at para leads ganhas (won_at não existe)
  // Usamos uma estimativa simples baseada na posição do stage
  const avgCloseDays = wonCount > 0
    ? Math.round(wonLeads.reduce((sum, l) => {
        // placeholder: não temos won_at, usamos null por agora
        return sum
      }, 0) / wonCount) || null
    : null

  // --- Funil ---
  const funnelData = (funnelResult.data ?? []).map(stage => ({
    stage_id: stage.id,
    name: stage.name,
    position: stage.position,
    count: Array.isArray(stage.leads) ? stage.leads.length : 0,
  }))

  // --- Por fonte ---
  const sourceCounts = new Map<string, number>()
  for (const lead of (sourceResult.data ?? [])) {
    const src = lead.source ?? 'outro'
    sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1)
  }
  const bySource = [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  // --- Ao longo do tempo (agrupado por semana) ---
  const weekCounts = new Map<string, number>()
  for (const lead of (timeResult.data ?? [])) {
    const d = new Date(lead.created_at)
    // Início da semana (segunda-feira)
    const day = d.getDay()
    const diff = (day === 0 ? -6 : 1 - day)
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    const weekKey = d.toISOString().split('T')[0]
    weekCounts.set(weekKey, (weekCounts.get(weekKey) ?? 0) + 1)
  }
  const overTime = [...weekCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }))

  // --- Por agente ---
  const agentCounts = new Map<string, { name: string; count: number }>()
  for (const lead of (agentResult.data ?? [])) {
    const ps = lead.pipeline_stages as unknown as { is_won: boolean } | null
    if (!ps?.is_won) continue
    const userId = lead.assigned_to as string
    const userName = (lead.users as unknown as { name: string } | null)?.name ?? 'Desconhecido'
    const existing = agentCounts.get(userId)
    if (existing) {
      existing.count++
    } else {
      agentCounts.set(userId, { name: userName, count: 1 })
    }
  }
  const byAgent = [...agentCounts.entries()]
    .map(([user_id, { name, count }]) => ({ user_id, name, won_count: count }))
    .sort((a, b) => b.won_count - a.won_count)

  const result: ReportsData = {
    kpis: {
      total_leads: totalLeads,
      won_leads: wonCount,
      conversion_rate: conversionRate,
      pipeline_value: pipelineValue,
      avg_close_days: avgCloseDays,
    },
    funnel: funnelData,
    by_source: bySource,
    over_time: overTime,
    by_agent: byAgent,
  }

  return NextResponse.json(result)
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/api/reports/route.ts
git commit -m "feat: add reports API endpoint with KPIs and chart data"
```

---

## Task 3: Página de Relatórios

**Files:**
- Create: `app/(app)/reports/page.tsx`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Criar `app/(app)/reports/page.tsx`**

```tsx
'use client'
import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import { ReportsData, ReportPeriod } from '@/types'

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '1y', label: 'Último ano' },
]

const SOURCE_LABELS: Record<string, string> = {
  site: 'Site',
  instagram: 'Instagram',
  facebook: 'Facebook',
  referencia: 'Referência',
  outro: 'Outro',
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899']

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function formatWeek(week: string): string {
  const d = new Date(week)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('30d')
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period])

  const cardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '20px 24px',
  }

  const kpis = data?.kpis

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Relatórios</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Métricas de performance do pipeline</p>
        </div>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value as ReportPeriod)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: '8px 12px',
            fontSize: 13,
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          {PERIOD_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>A carregar...</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Total de Leads</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{kpis?.total_leads ?? 0}</p>
            </div>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Taxa de Conversão</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#10B981' }}>{kpis?.conversion_rate ?? 0}%</p>
            </div>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Valor em Pipeline</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{formatCurrency(kpis?.pipeline_value ?? 0)}</p>
            </div>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Leads Ganhas</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#3B82F6' }}>{kpis?.won_leads ?? 0}</p>
            </div>
          </div>

          {/* Gráficos — linha 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Funil */}
            <div style={cardStyle}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Funil de Conversão</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.funnel ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    formatter={(value: number) => [value, 'Leads']}
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Por fonte */}
            <div style={cardStyle}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Leads por Fonte</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={(data?.by_source ?? []).map(s => ({ ...s, name: SOURCE_LABELS[s.source] ?? s.source }))}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {(data?.by_source ?? []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    formatter={(value: number, name: string) => [value, name]}
                  />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráficos — linha 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Ao longo do tempo */}
            <div style={cardStyle}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Leads ao Longo do Tempo</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={(data?.over_time ?? []).map(d => ({ ...d, week: formatWeek(d.week) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    formatter={(value: number) => [value, 'Leads']}
                  />
                  <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Por agente */}
            <div style={cardStyle}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Performance por Agente</p>
              {(data?.by_agent ?? []).length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 16 }}>Sem dados de leads ganhas no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data?.by_agent ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                      formatter={(value: number) => [value, 'Ganhas']}
                    />
                    <Bar dataKey="won_count" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Adicionar link na Sidebar**

Em `components/layout/Sidebar.tsx`, localizar:

```typescript
  { href: '/activities', icon: '📅', label: 'Atividades', section: 'Principal' },
```

Substituir por:

```typescript
  { href: '/activities', icon: '📅', label: 'Atividades', section: 'Principal' },
  { href: '/reports', icon: '📊', label: 'Relatórios', section: 'Principal' },
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/reports/page.tsx" components/layout/Sidebar.tsx
git commit -m "feat: add reports page with KPI cards and 4 charts"
```

---

## Task 4: Teste Manual

- [ ] **Step 1: Iniciar servidor de desenvolvimento**

```bash
cd /Users/tomassampaio/Desktop/ImoFlow && npm run dev
```

- [ ] **Step 2: Navegar para `/reports`**

Esperado: página carrega com 4 KPI cards e 4 gráficos.

- [ ] **Step 3: Testar selector de período**

Mudar de "Últimos 30 dias" para "Último ano".
Esperado: dados atualizam sem reload da página.

- [ ] **Step 4: Verificar funil**

Esperado: gráfico horizontal com os stages do pipeline e número de leads em cada.

- [ ] **Step 5: Verificar sidebar**

Esperado: link "Relatórios 📊" visível na secção Principal, entre Atividades e Configurações.

- [ ] **Step 6: Push**

```bash
git push origin main
```
