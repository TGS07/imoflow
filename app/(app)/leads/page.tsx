'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lead, PipelineStage } from '@/types'
import { NewLeadModal } from '@/components/leads/NewLeadModal'
import { EmptyState } from '@/components/ui/EmptyState'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const personFilter = searchParams.get('person_id')

  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    fetch('/api/pipeline-stages').then(r => r.json()).then(setStages)
  }, [])

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (stageFilter) params.set('stage_id', stageFilter)
    if (personFilter) params.set('person_id', personFilter)
    try {
      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar leads')
      const data: Lead[] = await res.json()
      setLeads(data)
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, stageFilter, personFilter])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  function getStageInfo(lead: Lead) {
    const stage = lead.pipeline_stages ?? stages.find(s => s.id === lead.stage_id)
    return stage ?? { name: '—', color: '#666' }
  }

  return (
    <>
      {showModal && <NewLeadModal onClose={() => setShowModal(false)} onCreated={fetchLeads} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20 }}>Leads</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{leads.length} leads</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          + Novo Lead
        </button>
      </div>

      {personFilter && (
        <div className="page-enter" style={{ padding: '14px 32px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'var(--gold-glow)', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 6 }}>
            Filtrado por contacto
            <button onClick={() => router.push('/leads')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
          </span>
        </div>
      )}
      <div className="page-enter" style={{ padding: '20px 32px', display: 'flex', gap: 10 }}>
        <input
          placeholder="Pesquisar por nome, email ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
          style={{ flex: 1, background: 'var(--card)' }}
        />
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="input"
          style={{ width: 'auto', background: 'var(--card)' }}
        >
          <option value="">Todas as fases</option>
          {stages.filter(s => !s.is_lost).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div style={{ padding: '0 32px 32px' }}>
        {!loading && leads.length === 0 ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            {debouncedSearch || stageFilter ? (
              <EmptyState
                illustration="search"
                title="Nenhum resultado"
                description="Não encontrámos leads com esses critérios. Tenta ajustar a pesquisa ou os filtros."
              />
            ) : (
              <EmptyState
                illustration="leads"
                title="Ainda não tens leads"
                description="Os teus contactos e potenciais negócios aparecem aqui. Cria o primeiro para começar."
                action={{ label: '+ Novo Lead', onClick: () => setShowModal(true) }}
              />
            )}
          </div>
        ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>Nome</th>
                <th style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>Contacto</th>
                <th className="hide-mobile" style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>Interesse</th>
                <th className="hide-mobile" style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>Valor</th>
                <th className="hide-mobile" style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>Origem</th>
                <th className="hide-mobile" style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>Score</th>
                <th style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>Fase</th>
              </tr>
            </thead>
            <tbody>
              {loading && [0, 1, 2, 3].map(i => (
                <tr key={i}>
                  <td colSpan={7} style={{ padding: '8px 20px' }}>
                    <div className="skeleton" style={{ height: 34 }} />
                  </td>
                </tr>
              ))}
              {leads.map(lead => {
                const stageInfo = getStageInfo(lead)
                return (
                  <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="table-row" style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{lead.name}</td>
                    <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{lead.phone ?? lead.email ?? '—'}</td>
                    <td className="hide-mobile" style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{[lead.typology, lead.zone].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="hide-mobile" style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {lead.deal_value ? `${(lead.deal_value / 1000).toFixed(0)}K€` : lead.budget ? `${(lead.budget / 1000).toFixed(0)}K€` : '—'}
                    </td>
                    <td className="hide-mobile" style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>{lead.source}</span>
                    </td>
                    <td className="hide-mobile" style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                      <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: lead.score > 70 ? 'var(--green)' : lead.score > 40 ? 'var(--gold)' : 'var(--red)', width: `${lead.score}%` }} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: `${stageInfo.color}22`, color: stageInfo.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {stageInfo.name}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </>
  )
}
