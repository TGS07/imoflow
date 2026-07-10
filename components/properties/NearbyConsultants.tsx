// components/properties/NearbyConsultants.tsx
// Consultores imobiliários de outras agências que atuam na zona deste imóvel —
// úteis para partilha de imóvel / angariação em parceria.
'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { buildWaLink } from '@/lib/whatsapp/utils'

type Consultant = {
  id: string
  name: string
  phone: string | null
  email: string | null
  agencyName: string | null
  workingZone: string | null
}

export function NearbyConsultants({ propertyId, propertyTitle }: {
  propertyId: string
  propertyTitle: string
}) {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/consultants`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setConsultants(data.consultants ?? [])
    } catch { setConsultants([]) }
    finally { setLoading(false) }
  }, [propertyId])

  useEffect(() => { load() }, [load])

  if (!loading && consultants.length === 0) return null

  const waText = `Olá! Tenho um imóvel que pode interessar a algum cliente teu: ${propertyTitle}. Falamos?`

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div className="font-display" style={{ fontSize: 15, marginBottom: 4 }}>✦ Consultores nesta zona</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>Consultores de outras agências que atuam por aqui — úteis para partilha</div>

      {loading && <div className="skeleton" style={{ height: 52, borderRadius: 8 }} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {consultants.map(c => (
          <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Link href={`/people/${c.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </Link>
              {c.phone && (
                <a
                  href={buildWaLink(c.phone, waText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#25D366', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 6, padding: '4px 10px', textDecoration: 'none' }}
                >
                  💬 WhatsApp
                </a>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {c.agencyName && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--gold-glow)', color: 'var(--gold)', fontWeight: 500 }}>{c.agencyName}</span>
              )}
              {c.workingZone && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--gold-glow)', color: 'var(--gold)', fontWeight: 500 }}>{c.workingZone}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
