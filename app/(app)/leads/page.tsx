'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Lead } from '@/types'
import { NewLeadModal } from '@/components/leads/NewLeadModal'

const STAGE_COLORS: Record<string, string> = {
  lead: '#5C9EE0', visita: '#9B7FE8', proposta: '#E0A35C', negociacao: '#E0595C', fechado: '#4ECCA3'
}
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', visita: 'Visita', proposta: 'Proposta', negociacao: 'Negociação', fechado: 'Fechado'
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (stageFilter) params.set('stage', stageFilter)
    const res = await fetch(`/api/leads?${params}`)
    const data = await res.json()
    setLeads(data)
    setLoading(false)
  }, [search, stageFilter])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  return (
    <>
      {showModal && <NewLeadModal onClose={() => setShowModal(false)} onCreated={fetchLeads} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 20 }}>Leads</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{leads.length} leads</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: 'var(--gold)', color: '#0D0D0F', border: 'none', borderRadius: 8, padding: '0 16px', height: 36, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Jost, sans-serif' }}>
          + Novo Lead
        </button>
      </div>

      <div style={{ padding: '20px 32px', display: 'flex', gap: 10 }}>
        <input
          placeholder="Pesquisar por nome, email ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }}
        />
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'Jost, sans-serif' }}
        >
          <option value="">Todas as fases</option>
          {Object.entries(STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div style={{ padding: '0 32px 32px' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nome', 'Contacto', 'Interesse', 'Origem', 'Score', 'Fase'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>A carregar...</td></tr>
              )}
              {!loading && leads.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Nenhum lead encontrado.</td></tr>
              )}
              {leads.map(lead => (
                <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{lead.name}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{lead.phone ?? lead.email ?? '—'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)', fontSize: 12, color: 'var(--muted)' }}>{[lead.typology, lead.zone, lead.budget ? `até ${(lead.budget/1000).toFixed(0)}K€` : null].filter(Boolean).join(' · ') || '—'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>{lead.source}</span>
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                    <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: lead.score > 70 ? 'var(--green)' : lead.score > 40 ? 'var(--gold)' : 'var(--red)', width: `${lead.score}%` }} />
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid rgba(38,38,41,0.5)' }}>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: `${STAGE_COLORS[lead.stage]}22`, color: STAGE_COLORS[lead.stage], letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {STAGE_LABELS[lead.stage]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
