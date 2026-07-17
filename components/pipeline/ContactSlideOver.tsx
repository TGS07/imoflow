'use client'
import { useEffect } from 'react'
import { ContactDetailPanel } from '@/components/contacts/ContactDetailPanel'

type Props = {
  personId: string
  highlightLeadId?: string
  onClose: () => void
  onChanged?: () => void
}

// Gaveta lateral com a ficha completa do contacto, sobre o board da pipeline.
export function ContactSlideOver({ personId, highlightLeadId, onClose, onChanged }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,15,5,0.25)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(560px, 100vw)', background: 'var(--bg)', boxShadow: 'var(--shadow-md)', overflowY: 'auto', animation: 'slideIn 0.2s ease' }}>
        <ContactDetailPanel personId={personId} embedded onClose={onClose} onChanged={onChanged} highlightLeadId={highlightLeadId} />
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(24px); opacity: 0.6 } to { transform: translateX(0); opacity: 1 } }`}</style>
    </div>
  )
}
