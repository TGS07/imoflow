'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'

export interface Match {
  id: string
  status: string
  drafted_message: string
  created_at: string
  idealista_listings: {
    titulo: string | null
    zona: string | null
    tipologia: string | null
    preco: number | null
    m2: number | null
    extras: string[]
    link: string | null
  } | null
  leads: {
    id: string
    name: string
    phone: string | null
    email: string | null
  } | null
}

export function RecommendationsCarousel({ matches: initial }: { matches: Match[] }) {
  const [matches, setMatches] = useState(initial)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState(false)

  if (matches.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
        <Icon name="sparkle" size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
        <p style={{ fontSize: 15 }}>Sem recomendações pendentes</p>
        <p style={{ fontSize: 12, marginTop: 4 }}>Novas recomendações aparecem quando o scan do Idealista encontra imóveis que encaixam nas preferências dos seus leads.</p>
      </div>
    )
  }

  const match = matches[currentIndex]
  if (!match) return null
  const listing = match.idealista_listings
  const lead = match.leads

  async function handleAction(action: 'sent' | 'ignored', message?: string) {
    setLoading(true)
    try {
      await fetch(`/api/recommendations/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (action === 'sent' && lead?.phone && message) {
        const phone = lead.phone.replace(/\D/g, '')
        const encoded = encodeURIComponent(message)
        window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank')
      }

      setMatches((prev) => prev.filter((m) => m.id !== match.id))
      setCurrentIndex((prev) => Math.min(prev, matches.length - 2))
      setEditingId(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveEdit() {
    setLoading(true)
    try {
      await fetch(`/api/recommendations/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edited', drafted_message: editText }),
      })
      setMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, drafted_message: editText, status: 'edited' } : m))
      )
      setEditingId(null)
    } finally {
      setLoading(false)
    }
  }

  const message = match.drafted_message

  return (
    <div>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {currentIndex + 1} de {matches.length}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: currentIndex === 0 ? 'default' : 'pointer', opacity: currentIndex === 0 ? 0.4 : 1 }}
          >
            ← Anterior
          </button>
          <button
            onClick={() => setCurrentIndex((i) => Math.min(matches.length - 1, i + 1))}
            disabled={currentIndex === matches.length - 1}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: currentIndex === matches.length - 1 ? 'default' : 'pointer', opacity: currentIndex === matches.length - 1 ? 0.4 : 1 }}
          >
            Seguinte →
          </button>
        </div>
      </div>

      {/* Card */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden' }}>
        {/* Listing info */}
        <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                {listing?.titulo ?? 'Imóvel sem título'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                {[listing?.zona, listing?.tipologia, listing?.m2 ? `${listing.m2} m²` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
            {listing?.preco && (
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                {listing.preco.toLocaleString('pt-PT')}€
              </div>
            )}
          </div>
          {listing?.extras && listing.extras.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {listing.extras.map((extra, i) => (
                <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                  {extra}
                </span>
              ))}
            </div>
          )}
          {listing?.link && (
            <a href={listing.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', marginTop: 12, display: 'inline-block' }}>
              Ver no Idealista ↗
            </a>
          )}
        </div>

        {/* Lead info */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 4 }}>Lead</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{lead?.name ?? '—'}</div>
          {lead?.phone && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{lead.phone}</div>
          )}
        </div>

        {/* Message */}
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 8 }}>Mensagem</div>
          {editingId === match.id ? (
            <div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={6}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={handleSaveEdit}
                  disabled={loading}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer' }}
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
              {message}
            </p>
          )}
        </div>

        {/* Actions */}
        {editingId !== match.id && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => handleAction('sent', message)}
              disabled={loading || !lead?.phone}
              title={!lead?.phone ? 'Lead sem número de telefone' : undefined}
              style={{ flex: 1, minWidth: 120, padding: '10px 16px', borderRadius: 8, background: '#25D366', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: lead?.phone ? 'pointer' : 'not-allowed', opacity: lead?.phone ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Icon name="whatsapp" size={16} />
              Enviar WhatsApp
            </button>
            <button
              onClick={() => { setEditingId(match.id); setEditText(message) }}
              disabled={loading}
              style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="pencil" size={14} />
              Editar
            </button>
            <button
              onClick={() => handleAction('ignored')}
              disabled={loading}
              style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}
            >
              Ignorar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
