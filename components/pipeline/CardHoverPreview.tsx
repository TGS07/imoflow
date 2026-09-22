'use client'
import { useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { Lead } from '@/types'
import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'
import { formatPhoneDisplay } from '@/lib/whatsapp/utils'
import { cardFieldValue, daysInStage, type PipelineCardFields } from '@/lib/pipeline/card-fields'

function stripCountryCode(phone: string): string {
  const normalized = phone.replace(/\D/g, '')
  if (normalized.startsWith('351') && normalized.length > 9) return normalized.slice(3)
  return normalized
}

export function CardHoverPreview({ lead, cardFields, onClick, onMouseLeave }: {
  lead: Lead
  cardFields: PipelineCardFields
  onClick: () => void
  onMouseLeave: () => void
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  async function copyToClipboard(text: string, fieldKey: string, e: ReactMouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldKey)
      setTimeout(() => setCopiedField(prev => prev === fieldKey ? null : prev), 1500)
    } catch {}
  }

  const primaryText = cardFieldValue(lead, cardFields.primary) ?? lead.people?.name ?? lead.name
  const secondaryText = cardFieldValue(lead, cardFields.secondary)
  const showName = !!lead.people?.name && lead.people.name !== primaryText && lead.people.name !== secondaryText
  const initials = (lead.people?.name ?? lead.name).split(' ').map((n: string) => n[0]).slice(0, 2).join('')
  const phone = lead.people?.phone ?? lead.phone
  const email = lead.people?.email ?? lead.email
  const days = daysInStage(lead)

  return (
    <div
      onMouseLeave={onMouseLeave}
      onClick={onMouseLeave}
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,13,15,0.35)', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={e => { e.stopPropagation(); onClick() }}
        className="card"
        style={{ width: 360, maxWidth: '90vw', background: 'var(--surface)', borderRadius: 12, padding: '20px 22px', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', flex: 1, minWidth: 0 }}>{primaryText}</div>
          {lead.people?.types && <ContactTypeChips types={lead.people.types} size={10} />}
        </div>
        {secondaryText && secondaryText !== primaryText && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>{secondaryText}</div>
        )}
        {showName && (
          <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 10 }}>👤 {lead.people!.name}</div>
        )}
        {(phone || email) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>📞 {formatPhoneDisplay(phone)}</span>
                <button
                  className="copy-field-btn"
                  onClick={e => copyToClipboard(stripCountryCode(phone), 'phone', e)}
                  title="Copiar número"
                >
                  {copiedField === 'phone' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  )}
                </button>
              </div>
            )}
            {email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>✉️ {email}</span>
                <button
                  className="copy-field-btn"
                  onClick={e => copyToClipboard(email, 'email', e)}
                  title="Copiar email"
                >
                  {copiedField === 'email' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', padding: '4px 10px', borderRadius: 999, background: 'var(--border)', display: 'inline-block' }}>
          {days} dia{days === 1 ? '' : 's'} nesta fase
        </div>
      </div>
    </div>
  )
}
