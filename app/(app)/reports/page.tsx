'use client'
import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import type { ReportsData, ReportPeriod } from '@/types'

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
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatWeek(weekStart: string): string {
  const d = new Date(weekStart)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('30d')
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetch(`/api/reports?period=${period}`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error('Erro ao carregar relatórios')
        return r.json()
      })
      .then((json: ReportsData) => { setData(json); setLoading(false) })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setLoading(false)
      })
    return () => controller.abort()
  }, [period])

  const kpis = data?.kpis

  return (
    <div className="page-enter page-pad" style={{ padding: '28px 32px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 22, marginBottom: 4 }}>Relatórios</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Métricas de performance do pipeline</p>
        </div>
        <select
          aria-label="Selecionar período"
          value={period}
          onChange={e => setPeriod(e.target.value as ReportPeriod)}
          className="input"
          style={{ width: 'auto' }}
        >
          {PERIOD_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }} className="kpi-grid">
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 10 }} />)}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="stats-grid stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Total de Leads', value: kpis?.total_leads ?? 0, color: 'var(--text)', fmt: String },
              { label: 'Taxa de Conversão', value: `${kpis?.conversion_rate ?? 0}%`, color: '#10B981', fmt: String },
              { label: 'Valor em Pipeline', value: formatCurrency(kpis?.pipeline_value ?? 0), color: 'var(--text)', fmt: String },
              { label: 'Leads Ganhas', value: kpis?.won_leads ?? 0, color: '#3B82F6', fmt: String },
            ].map(item => (
              <div key={item.label} className="card" style={{ padding: '20px 24px' }}>
                <p style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 500 }}>{item.label}</p>
                <p style={{ fontSize: 26, fontWeight: 700, color: item.color, letterSpacing: '-0.02em' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Gráficos — linha 1 */}
          <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div className="card" style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Funil de Conversão</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.funnel ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} formatter={(value) => [value, 'Leads']} />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: '20px 24px' }}>
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
                    {(data?.by_source ?? []).map((entry, i) => (
                      <Cell key={entry.source} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráficos — linha 2 */}
          <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card" style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Leads ao Longo do Tempo</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={(data?.over_time ?? []).map(d => ({ ...d, week: formatWeek(d.week_start) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} formatter={(value) => [value, 'Leads']} />
                  <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Performance por Agente</p>
              {(data?.by_agent ?? []).length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 16 }}>Sem dados de leads ganhas no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data?.by_agent ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} formatter={(value) => [value, 'Ganhas']} />
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
