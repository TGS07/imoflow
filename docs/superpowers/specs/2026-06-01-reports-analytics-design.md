# Relatórios/Analytics — Design Spec

**Date:** 2026-06-01
**Status:** Approved
**Subsystem:** #6

---

## Overview

Página de relatórios em `/reports` com KPIs e gráficos calculados em runtime a partir das tabelas existentes. Sem novas tabelas na BD. Dados calculados server-side via API route, visualizados com Recharts no cliente.

---

## Métricas

### KPIs (cards no topo)

| Métrica | Cálculo |
|---------|---------|
| Total de leads | `COUNT(*)` onde `created_at >= cutoff` |
| Taxa de conversão | `COUNT(*) WHERE is_won / COUNT(*) total` × 100% |
| Valor em pipeline | `SUM(deal_value)` onde lead não está perdida |
| Tempo médio de fecho | `AVG(won_at - created_at)` onde `is_won = true` |

### Gráficos

| Gráfico | Tipo | Dados |
|---------|------|-------|
| Funil de conversão | Bar horizontal | leads por stage, ordenado por posição |
| Leads por fonte | Donut chart | leads agrupadas por `source` |
| Leads ao longo do tempo | Line chart | leads criadas agrupadas por semana |
| Performance por agente | Bar vertical | leads ganhas por agente (`assigned_to`) |

---

## Filtros

- **Período:** `30d` (default) | `90d` | `6m` | `1y`
- Query param: `?period=30d`
- Implementado via selector na UI, sem reload de página (fetch ao mudar)

---

## Arquitetura

### API Route: `GET /api/reports?period=30d`

Retorna todos os dados num único request:

```typescript
type ReportsData = {
  kpis: {
    total_leads: number
    won_leads: number
    conversion_rate: number  // percentagem 0-100
    pipeline_value: number
    avg_close_days: number | null
  }
  funnel: Array<{ stage_id: string; name: string; position: number; count: number }>
  by_source: Array<{ source: string; count: number }>
  over_time: Array<{ week: string; count: number }>
  by_agent: Array<{ user_id: string; name: string; won_count: number }>
}
```

**Implementação:** múltiplas queries Supabase paralelas (`Promise.all`), uma por grupo de dados. Filtradas por `agency_id` via RLS e por `cutoff` date calculado a partir do `period` param.

**Cálculo do cutoff:**
- `30d` → hoje - 30 dias
- `90d` → hoje - 90 dias
- `6m` → hoje - 6 meses
- `1y` → hoje - 1 ano

### Página: `app/(app)/reports/page.tsx`

- Client component (`'use client'`)
- Estado: `period` (default `30d`), `data: ReportsData | null`, `loading: boolean`
- Fetch ao montar e ao mudar `period`
- Selector de período no topo
- 4 KPI cards
- 4 gráficos com Recharts

### Sidebar

Adicionar link `{ href: '/reports', icon: '📊', label: 'Relatórios', section: 'Principal' }` após Atividades.

---

## Dependências

- `recharts` — instalar via `npm install recharts`
- Sem novas migrações SQL

---

## Queries SQL

### KPIs

```sql
-- total e won no período
SELECT
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE ps.is_won = true) AS won_leads,
  SUM(l.deal_value) FILTER (WHERE ps.is_lost = false OR l.stage_id IS NULL) AS pipeline_value,
  AVG(EXTRACT(EPOCH FROM (l.updated_at - l.created_at)) / 86400)
    FILTER (WHERE ps.is_won = true) AS avg_close_days
FROM leads l
LEFT JOIN pipeline_stages ps ON ps.id = l.stage_id
WHERE l.created_at >= :cutoff
```

### Funil

```sql
SELECT ps.id, ps.name, ps.position, COUNT(l.id) AS count
FROM pipeline_stages ps
LEFT JOIN leads l ON l.stage_id = ps.id AND l.created_at >= :cutoff
GROUP BY ps.id, ps.name, ps.position
ORDER BY ps.position
```

### Por fonte

```sql
SELECT source, COUNT(*) AS count
FROM leads
WHERE created_at >= :cutoff
GROUP BY source
ORDER BY count DESC
```

### Ao longo do tempo

```sql
SELECT date_trunc('week', created_at) AS week, COUNT(*) AS count
FROM leads
WHERE created_at >= :cutoff
GROUP BY week
ORDER BY week
```

### Por agente

```sql
SELECT u.id, u.name, COUNT(l.id) AS won_count
FROM leads l
JOIN users u ON u.id = l.assigned_to
JOIN pipeline_stages ps ON ps.id = l.stage_id
WHERE ps.is_won = true AND l.created_at >= :cutoff
GROUP BY u.id, u.name
ORDER BY won_count DESC
```

---

## Out of Scope

- Export para CSV/PDF
- Relatórios personalizados
- Comparação entre períodos
- Drill-down por lead individual
- Gráficos em tempo real (live)
