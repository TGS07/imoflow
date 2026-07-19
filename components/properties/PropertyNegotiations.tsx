// components/properties/PropertyNegotiations.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { Lead } from '@/types'

// Leads ligadas a este imóvel: ativas ("quem está a negociar") e fechadas.
// Atalho "Foi este o comprador" define properties.buyer_id e, opcionalmente,
// marca o imóvel como vendido.
export function PropertyNegotiations({ propertyId, hasBuyer, onChange }: {
  propertyId: string
  hasBuyer: boolean
  onChange: () => void
}) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads?property_id=${propertyId}`)
      const data = res.ok ? await res.json() : []
      setLeads(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [propertyId])

  useEffect(() => { load() }, [load])

  const active = leads.filter(l => l.pipeline_stages && !l.pipeline_stages.is_won && !l.pipeline_stages.is_lost)
  const won = leads.filter(l => l.pipeline_stages?.is_won)

  async function markBuyer(lead: Lead) {
    if (!lead.person_id) return
    setBusy(lead.id)
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer_id: lead.person_id }),
      })
      if (res.ok && confirm('Marcar o imóvel como vendido?')) {
        await fetch(`/api/properties/${propertyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'vendido' }),
        })
      }
      onChange()
    } finally { setBusy(null) }
  }

  if (loading || (active.length === 0 && won.length === 0)) return null

  const row = (lead: Lead, showButton: boolean) => {
    const stage = lead.pipeline_stages
    return (
      <div key={lead.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/leads/${lead.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textDecoration: 'none', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.people?.name ?? lead.name}
          </Link>
          {stage && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: `${stage.color}1A`, border: `1px solid ${stage.color}40`, color: stage.color, fontWeight: 600, flexShrink: 0 }}>
              {lead.pipelines?.name ? `${lead.pipelines.name} · ` : ''}{stage.name}
            </span>
          )}
        </div>
        {showButton && lead.person_id && (
          <button onClick={() => markBuyer(lead)} disabled={busy === lead.id} className="btn btn-soft btn-sm" style={{ marginTop: 8 }}>
            {busy === lead.id ? 'A associar…' : 'Foi este o comprador'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div className="font-display" style={{ fontSize: 15, marginBottom: 14 }}>Negociações em curso</div>
      {active.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sem negociações ativas.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map(l => row(l, true))}
        </div>
      )}
      {won.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>Negócios fechados</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {won.map(l => row(l, !hasBuyer))}
          </div>
        </div>
      )}
    </div>
  )
}
