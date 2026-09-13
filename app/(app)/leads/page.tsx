'use client'
import { useState, useEffect, useCallback } from 'react'
import { HelpButton } from '@/components/help/HelpButton'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lead, PipelineStage } from '@/types'
import { NewLeadModal } from '@/components/leads/NewLeadModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPhoneDisplay } from '@/lib/whatsapp/utils'
import { Icon } from '@/components/ui/Icon'

const PAGE_SIZE = 10

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Hoje'
  if (days === 1) return 'Há 1 dia'
  if (days < 30) return `Há ${days} dias`
  const months = Math.floor(days / 30)
  if (months < 12) return months === 1 ? 'Há 1 mês' : `Há ${months} meses`
  const years = Math.floor(months / 12)
  return years === 1 ? 'Há 1 ano' : `Há ${years} anos`
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [page, setPage] = useState(1)
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

  useEffect(() => { setPage(1) }, [debouncedSearch, stageFilter])

  function getStageInfo(lead: Lead) {
    const stage = lead.pipeline_stages ?? stages.find(s => s.id === lead.stage_id)
    return stage ?? { name: '—', color: '#666' }
  }

  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = leads.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(currentPage * PAGE_SIZE, leads.length)
  const paginatedLeads = leads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <>
      {showModal && <NewLeadModal onClose={() => setShowModal(false)} onCreated={fetchLeads} />}
      <div className="page-enter" style={{ padding: 'var(--space-6) var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <div>
            <h1 className="font-display" style={{ fontSize: 'var(--fs-2xl)', lineHeight: 1.1 }}>Leads <HelpButton section="leads" /></h1>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 'var(--space-1)' }}>{leads.length} leads</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button onClick={() => {}} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="send" size={14} />
              Exportar
            </button>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Icon name="plus" size={14} /> Novo Lead
            </button>
          </div>
        </div>

        {personFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <span className="badge badge-gold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Filtrado por contacto
              <button onClick={() => router.push('/leads')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 'var(--fs-sm)', padding: 0, lineHeight: 1 }}>
                <Icon name="close" size={10} />
              </button>
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              placeholder="Pesquisar por nome, email ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input"
              style={{ width: '100%', paddingLeft: 34, background: 'var(--surface)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              onClick={() => setStageFilter('')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                background: stageFilter === '' ? 'var(--gold)' : 'transparent',
                color: stageFilter === '' ? 'white' : 'var(--muted)',
                border: `1px solid ${stageFilter === '' ? 'var(--gold)' : 'var(--border)'}`,
                transition: 'all 0.15s var(--ease)',
              }}
            >
              Todos
            </button>
            {stages.filter(s => !s.is_lost).map(s => (
              <button
                key={s.id}
                onClick={() => setStageFilter(s.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: stageFilter === s.id ? 'var(--gold)' : 'transparent',
                  color: stageFilter === s.id ? 'white' : 'var(--muted)',
                  border: `1px solid ${stageFilter === s.id ? 'var(--gold)' : 'var(--border)'}`,
                  transition: 'all 0.15s var(--ease)',
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div>
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
              <tr className="table-header">
                <th>Lead</th>
                <th className="hide-mobile">Tipologia</th>
                <th className="hide-mobile">Zona</th>
                <th className="hide-mobile">Valor</th>
                <th>Etapa</th>
                <th>Contacto</th>
                <th className="hide-mobile">Criado</th>
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
              {paginatedLeads.map(lead => {
                const stageInfo = getStageInfo(lead)
                return (
                  <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="table-row" style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar-initials">
                          {lead.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{lead.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{lead.email ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hide-mobile" style={{ color: 'var(--muted)', fontSize: 12 }}>{lead.typology ?? '—'}</td>
                    <td className="hide-mobile" style={{ color: 'var(--muted)', fontSize: 12 }}>{lead.zone ?? '—'}</td>
                    <td className="hide-mobile" style={{ fontWeight: 700, color: 'var(--text)' }}>
                      {lead.deal_value ? `${(lead.deal_value / 1000).toFixed(0)}K€` : lead.budget ? `${(lead.budget / 1000).toFixed(0)}K€` : '—'}
                    </td>
                    <td>
                      <span className="stage-badge" style={{ background: `${stageInfo.color}15`, color: stageInfo.color, border: `1px solid ${stageInfo.color}30` }}>
                        {stageInfo.name}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{(lead.phone ? formatPhoneDisplay(lead.phone) : lead.phone) ?? '—'}</td>
                    <td className="hide-mobile" style={{ color: 'var(--muted)', fontSize: 12 }}>{timeAgo(lead.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && leads.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
                A mostrar {pageStart}-{pageEnd} de {leads.length} leads
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-ghost btn-sm"
                  style={{ opacity: currentPage === 1 ? 0.4 : 1 }}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: p === currentPage ? 'var(--gold)' : 'transparent',
                      color: p === currentPage ? 'white' : 'var(--muted)',
                      border: `1px solid ${p === currentPage ? 'var(--gold)' : 'var(--border)'}`,
                      transition: 'all 0.15s var(--ease)',
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="btn btn-ghost btn-sm"
                  style={{ opacity: currentPage === totalPages ? 0.4 : 1 }}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
      </div>
    </>
  )
}
