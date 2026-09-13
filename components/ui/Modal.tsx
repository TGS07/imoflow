'use client'
import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  const maxWidth = size === 'sm' ? '420px' : size === 'lg' ? '720px' : '560px'

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog"
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ maxWidth, width: '100%', border: 'none', padding: 0, borderRadius: 'var(--radius)', background: 'var(--surface)' }}
    >
      <div className="modal" style={{ maxHeight: 'calc(100vh - 48px)', width: '100%', animation: 'none', border: 'none', borderRadius: 'var(--radius)' }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <h2 className="font-display" style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }}>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Fechar" style={{ fontSize: '18px' }}>{'✕'}</button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  )
}
