'use client'
import { useEffect, useMemo, useState } from 'react'
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

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
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
      {label}
    </button>
  )
}

export default function ExportarPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [pipelineIds, setPipelineIds] = useState<string[]>([])
  const [stageIds, setStageIds] = useState<string[]>([])
  const [temperature, setTemperature] = useState('')
  const [rows, setRows] = useState<ExportRow[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loadedQuery, setLoadedQuery] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/pipelines').then(r => r.ok ? r.json() : []).then(setPipelines).catch(() => {})
    fetch('/api/pipeline-stages').then(r => r.ok ? r.json() : []).then(setStages).catch(() => {})
  }, [])

  const params = new URLSearchParams({ pipeline_ids: pipelineIds.join(','), stage_ids: stageIds.join(',') })
  if (temperature) params.set('temperature', temperature)
  const query = params.toString()
  const hasStages = stageIds.length > 0
  const loading = hasStages && loadedQuery !== query

  useEffect(() => {
    if (!hasStages) return
    let stale = false
    fetch(`/api/exports/contacts?${query}`)
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data: ExportRow[]) => {
        if (stale) return
        setRows(data)
        setExcluded(new Set())
        setError(null)
        setLoadedQuery(query)
      })
      .catch(() => {
        if (stale) return
        setRows([])
        setError('Não foi possível carregar os contactos.')
        setLoadedQuery(query)
      })
    return () => { stale = true }
  }, [query, hasStages])

  function applyStages(next: string[]) {
    setStageIds(next)
    if (next.length === 0) {
      setRows([])
      setLoadedQuery('')
      setExcluded(new Set())
    }
  }

  // Tirar uma pipeline tira também as fases dela; as outras mantêm-se escolhidas.
  function togglePipeline(id: string) {
    if (pipelineIds.includes(id)) {
      setPipelineIds(pipelineIds.filter(p => p !== id))
      const removed = new Set(stages.filter(s => s.pipeline_id === id).map(s => s.id))
      applyStages(stageIds.filter(s => !removed.has(s)))
    } else {
      setPipelineIds([...pipelineIds, id])
    }
  }

  function toggleStage(id: string) {
    applyStages(stageIds.includes(id) ? stageIds.filter(s => s !== id) : [...stageIds, id])
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
          pipeline_ids: pipelineIds,
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

  const selectedPipelines = pipelines.filter(p => pipelineIds.includes(p.id))
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
              : 'Escolhe uma ou mais pipelines e as fases dos contactos a exportar.'}
          </p>
        </div>
        <button onClick={createExcel} disabled={selectedRows.length === 0 || loading || downloading} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <Icon name="download" size={14} />
          {downloading ? 'A criar...' : `Criar Excel (${selectedRows.length} contactos)`}
        </button>
      </div>

      <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)', marginBottom: 'var(--space-2)' }}>Pipelines</p>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        {pipelines.map(p => (
          <Chip key={p.id} label={p.name} active={pipelineIds.includes(p.id)} onClick={() => togglePipeline(p.id)} />
        ))}
      </div>

      {selectedPipelines.map(p => (
        <div key={p.id} style={{ marginBottom: 'var(--space-3)' }}>
          <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)', marginBottom: 'var(--space-2)' }}>Fases de {p.name}</p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            {stages.filter(s => s.pipeline_id === p.id).map(s => (
              <Chip key={s.id} label={s.name} active={stageIds.includes(s.id)} onClick={() => toggleStage(s.id)} />
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', margin: 'var(--space-4) 0 var(--space-6)' }}>
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

      {error && <p style={{ color: 'var(--red)', fontSize: 'var(--fs-base)', marginBottom: 'var(--space-4)' }}>{error}</p>}

      <div className="card" style={{ overflow: 'hidden' }}>
        {stageIds.length === 0 ? (
          <EmptyState illustration="search" title="Escolhe as fases" description="Os contactos aparecem aqui depois de escolheres pelo menos uma pipeline e uma fase." />
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
                  <td className="hide-mobile" style={{ color: 'var(--muted)', fontSize: 12 }}>{selectedPipelines.length > 1 ? `${row.pipeline} · ${row.stage}` : row.stage}</td>
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
