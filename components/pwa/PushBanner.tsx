'use client'

import { useEffect, useState } from 'react'
import { isPushSupported, getPushSubscription, subscribeToPush } from '@/lib/push/client'

export function PushBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    if (localStorage.getItem('push_banner_dismissed')) return
    if (Notification.permission === 'denied') return

    getPushSubscription().then((sub) => {
      if (!sub) setVisible(true)
    })
  }, [])

  async function handleActivate() {
    const sub = await subscribeToPush()
    if (sub) {
      setVisible(false)
    } else {
      localStorage.setItem('push_banner_dismissed', '1')
      setVisible(false)
    }
  }

  function handleDismiss() {
    localStorage.setItem('push_banner_dismissed', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 16px',
      background: 'var(--gold-glow)',
      borderBottom: '1px solid rgba(176,125,46,0.3)',
      fontSize: 'var(--fs-sm)',
      color: 'var(--text)',
    }}>
      <span style={{ flex: 1 }}>Ative notificações para não perder novos leads e tarefas</span>
      <button
        onClick={handleActivate}
        className="btn btn-gold"
        style={{ padding: '5px 14px', fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap' }}
      >
        Ativar
      </button>
      <button
        onClick={handleDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: '0 4px' }}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  )
}
