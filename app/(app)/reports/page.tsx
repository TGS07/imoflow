'use client'
import { useState, useEffect } from 'react'
import { HelpButton } from '@/components/help/HelpButton'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import type { ReportsData, ReportPeriod } from '@/types'
import { Icon } from '@/components/ui/Icon'

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
]

const SOURCE_LABELS: Record<string, string> = {
  site: 'Site',
  instagram: 'Instagram',
  facebook: 'Facebook',
  referencia: 'Referência',
  outro: 'Outro',
}

const CHART_COLORS = ['#B07D2E', '#C9A84C', '#7A5520', '#D4A94F', '#8B6F30', '#A0894A']

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
    <>
      <div className="page-enter" style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div>
            <h1 className="font-display" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.1 }}>Relatórios <HelpButton section="reports" /></h1>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 'var(--space-1)' }}>Métricas de performance do pipeline</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div
              role="group"
              aria-label="Selecionar período"
              style={{ display: 'flex', gap: 2, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 3, border: '1px solid var(--border)' }}
            >
              {PERIOD_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setPeriod(o.value)}
                  aria-pressed={period === o.value}
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 14px',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 600,
                    borderRadius: 8,
                    transition: 'background 0.15s var(--ease), color 0.15s var(--ease)',
                    background: period === o.value ? 'var(--gold)' : 'transparent',
                    color: period === o.value ? '#fff' : 'var(--muted)',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button onClick={() => {}} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="send" size={14} />
              Exportar
            </button>
          </div>
        </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-base)', marginBottom: 'var(--space-4)' }}>{error}</p>}

      {loading ? (
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 'var(--radius-sm)' }} />)}
        </div>
      ) : (
        <>
          <div className="stats-grid stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
            {[
              { label: 'LEADS NOVOS', value: kpis?.total_leads ?? 0, icon: 'leads' as const },
              { label: 'VISITAS REALIZADAS', value: kpis?.total_leads ?? 0, icon: 'home' as const },
              { label: 'PROPOSTAS ENVIADAS', value: kpis?.won_leads ?? 0, icon: 'send' as const },
              { label: 'VALOR PIPELINE', value: formatCurrency(kpis?.pipeline_value ?? 0), icon: 'chart' as const },
            ].map(item => (
              <div key={item.label} className="card" style={{ padding: 'var(--space-4) var(--space-6)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(to right, transparent, var(--gold-bright), transparent)', opacity: 0.45 }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <span className="section-label">{item.label}</span>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--gold-glow)', border: '1px solid rgba(176,125,46,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
                    <Icon name={item.icon} size={15} />
                  </div>
                </div>
                <p className="font-display" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.05 }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Gráficos — linha 1 */}
          <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="card" style={{ padding: 'var(--space-4) var(--space-6)' }}>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <p className="font-display" style={{ fontSize: 15, color: 'var(--text)', fontWeight: 700 }}>Leads por Semana</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Novos leads captados por semana</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={(data?.over_time ?? []).map(d => ({ ...d, week: formatWeek(d.week_start) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} formatter={(value) => [value, 'Leads']} />
                  <Bar dataKey="count" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: 'var(--space-4) var(--space-6)' }}>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <p className="font-display" style={{ fontSize: 15, color: 'var(--text)', fontWeight: 700 }}>Leads por Etapa</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Distribuição atual do pipeline</p>
              </div>
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data?.funnel ?? []}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {(data?.funnel ?? []).map((entry, i) => (
                        <Cell key={entry.stage_id} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} formatter={(value) => [value, 'Leads']} />
                    <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <p className="font-display" style={{ fontSize: 22, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                    {(data?.funnel ?? []).reduce((sum, s) => sum + s.count, 0)}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</p>
                </div>
              </div>
            </div>
          </div>

          {/* Gráficos — linha 2 */}
          <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="card" style={{ padding: 'var(--space-4) var(--space-6)' }}>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <p className="font-display" style={{ fontSize: 15, color: 'var(--text)', fontWeight: 700 }}>Leads por Fonte</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>De onde vêm os leads do período</p>
              </div>
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

            <div className="card" style={{ padding: 'var(--space-4) var(--space-6)' }}>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <p className="font-display" style={{ fontSize: 15, color: 'var(--text)', fontWeight: 700 }}>Performance por Agente</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Leads ganhas por agente no período</p>
              </div>
              {(data?.by_agent ?? []).length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 16 }}>Sem dados de leads ganhas no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data?.by_agent ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} formatter={(value) => [value, 'Ganhas']} />
                    <Bar dataKey="won_count" fill="#B07D2E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tabela de desempenho do pipeline */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-4) var(--space-6) var(--space-1)' }}>
              <p className="font-display" style={{ fontSize: 15, color: 'var(--text)', fontWeight: 700 }}>Desempenho do Pipeline</p>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, marginBottom: 12 }}>Resumo por etapa no período selecionado</p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="table-header">
                    <th>Etapa</th>
                    <th>Leads</th>
                    <th>Valor Total</th>
                    <th>Taxa Conversão</th>
                    <th>Tempo Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.funnel ?? []).length === 0 ? (
                    <tr className="table-row">
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sem dados no período.</td>
                    </tr>
                  ) : (
                    (data?.funnel ?? []).map((stage, i) => {
                      const total = kpis?.total_leads ?? 0
                      const rate = total > 0 ? Math.round((stage.count / total) * 100) : 0
                      return (
                        <tr key={stage.stage_id} className="table-row">
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                              {stage.name}
                            </span>
                          </td>
                          <td>{stage.count}</td>
                          <td>{formatCurrency(stage.value)}</td>
                          <td>
                            <span className="badge badge-green">
                              {rate}%
                            </span>
                          </td>
                          <td>{kpis?.avg_close_days != null ? `${kpis.avg_close_days} dias` : '—'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      </div>
    </>
  )
}
