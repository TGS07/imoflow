'use client'
import { useState } from 'react'
import type { PortalRecommendedProperty } from '@/lib/portal/get-portal-data'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function PortalPropertyCard({
  property,
  onFavorite,
  onRequestVisit,
}: {
  property: PortalRecommendedProperty
  onFavorite: (propertyId: string) => Promise<void>
  onRequestVisit: (propertyId: string) => Promise<void>
}) {
  const [favorited, setFavorited] = useState(property.is_favorited)
  const [requesting, setRequesting] = useState(false)
  const [requested, setRequested] = useState(false)

  const details = [property.zone, property.typology, property.area_m2 ? `${property.area_m2}m²` : null, property.city]
    .filter(Boolean)
    .join(' · ')

  async function handleFavorite() {
    setFavorited(true) // resposta imediata (otimista); não há "desfavoritar"
    await onFavorite(property.id)
  }

  async function handleRequestVisit() {
    setRequesting(true)
    try {
      await onRequestVisit(property.id)
      setRequested(true)
      setTimeout(() => setRequested(false), 3000)
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 160, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {property.photos?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={property.photos[0]} alt={property.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
            <path d="M3 10.5L12 3l9 7.5" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <button
          type="button"
          onClick={handleFavorite}
          aria-label="Favoritar"
          style={{
            position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={favorited ? '#DC2626' : 'none'} stroke={favorited ? '#DC2626' : 'var(--muted)'} strokeWidth="1.8">
            <path d="M12 21s-7.5-4.8-10-9.3C.4 8.3 2 4.5 5.8 4.5c2 0 3.5 1.1 4.2 2.4.7-1.3 2.2-2.4 4.2-2.4C17.9 4.5 19.6 8.3 18 11.7 15.5 16.2 12 21 12 21z" />
          </svg>
        </button>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{property.title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{details || '—'}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 10, gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 15 }}>
            {property.price ? formatCurrency(property.price) : '—'}
          </span>
          <button
            type="button"
            onClick={handleRequestVisit}
            disabled={requesting}
            className="btn btn-primary btn-sm"
            style={{ opacity: requesting ? 0.6 : 1, whiteSpace: 'nowrap' }}
          >
            {requested ? 'Pedido enviado ✓' : requesting ? 'A enviar…' : 'Pedir visita'}
          </button>
        </div>
      </div>
    </div>
  )
}
