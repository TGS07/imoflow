// components/properties/SuggestedBuyers.tsx
// Compradores/investidores compatíveis com o imóvel, com contacto direto WhatsApp.
'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { buildWaLink } from '@/lib/whatsapp/utils'

type Match = {
  id: string
  name: string
  phone: string | null
  email: string | null
  types: string[]
  score: number
  reasons: string[]
}

export function SuggestedBuyers({ propertyId, propertyTitle, propertyPrice }: {
  propertyId: string
  propertyTitle: string
  propertyPrice: number | null
}) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/matches`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMatches(data.matches ?? [])
    } catch { setMatches([]) }
    finally { setLoading(false) }
  }, [propertyId])

  useEffect(() => { load() }, [load])

  const waText = `Olá! Tenho um imóvel que pode interessar: ${propertyTitle}${propertyPrice ? ` (€${propertyPrice.toLocaleString('pt-PT')})` : ''}. Quer saber mais?`

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div className="font-display" style={{ fontSize: 15, marginBottom: 4 }}>✦ Compradores sugeridos</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>Contactos compatíveis por capacidade, zona e procura</div>

      {loading && <div className="skeleton" style={{ height: 52, borderRadius: 8 }} />}
      {!loading && matches.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sem contactos compatíveis. Preenche a capacidade, zona e procura dos teus compradores para veres sugestões.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map(m => (
          <div key={m.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Link href={`/people/${m.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.name}
              </Link>
              {m.phone && (
                <a
                  href={buildWaLink(m.phone, waText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#25D366', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 6, padding: '4px 10px', textDecoration: 'none' }}
                >
                  💬 WhatsApp
                </a>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {m.reasons.map((r, i) => (
                <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--gold-glow)', color: 'var(--gold)', fontWeight: 500 }}>{r}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
