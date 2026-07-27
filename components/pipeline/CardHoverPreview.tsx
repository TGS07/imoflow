'use client'
import type { Lead } from '@/types'
import { ContactTypeChips } from '@/components/contacts/ContactTypeChips'
import { formatPhoneDisplay } from '@/lib/whatsapp/utils'
import { cardFieldValue, daysInStage, type PipelineCardFields } from '@/lib/pipeline/card-fields'

// Overlay centrado no ecrã, mostrado ao fim de ~450ms de hover sobre um
// card (gerido pelo KanbanBoard, não por este componente). Mostra a
// mesma info principal/secundária do card, mas sem cortar texto, mais
// nome/telefone/email e "dias nesta fase". Clicável — dispara a mesma
// ação do clique no card normal (abrir contacto ou navegar para o lead).
// Não repete os ícones de duplicar/trocar imóvel do card normal.
export function CardHoverPreview({ lead, cardFields, onClick, onMouseLeave }: {
  lead: Lead
  cardFields: PipelineCardFields
  onClick: () => void
  onMouseLeave: () => void
}) {
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
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,13,15,0.35)', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={onClick}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
            {phone && <div style={{ fontSize: 12, color: 'var(--text)' }}>📞 {formatPhoneDisplay(phone)}</div>}
            {email && <div style={{ fontSize: 12, color: 'var(--text)' }}>✉️ {email}</div>}
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', padding: '4px 10px', borderRadius: 999, background: 'var(--border)', display: 'inline-block' }}>
          {days} dia{days === 1 ? '' : 's'} nesta fase
        </div>
      </div>
    </div>
  )
}
