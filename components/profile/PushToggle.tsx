'use client'

import { useEffect, useState } from 'react'
import { isPushSupported, getPushSubscription, subscribeToPush, unsubscribeFromPush } from '@/lib/push/client'

type Status = 'loading' | 'active' | 'inactive' | 'denied' | 'unsupported'

export function PushToggle() {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!isPushSupported()) { setStatus('unsupported'); return }
    if (Notification.permission === 'denied') { setStatus('denied'); return }
    getPushSubscription().then((sub) => setStatus(sub ? 'active' : 'inactive'))
  }, [])

  async function toggle() {
    if (status === 'active') {
      await unsubscribeFromPush()
      setStatus('inactive')
    } else {
      const sub = await subscribeToPush()
      setStatus(sub ? 'active' : Notification.permission === 'denied' ? 'denied' : 'inactive')
    }
  }

  const labels: Record<Status, string> = {
    loading: 'A verificar…',
    active: 'Ativas neste dispositivo',
    inactive: 'Desativadas',
    denied: 'Bloqueadas pelo browser',
    unsupported: 'Não suportado neste browser',
  }

  const canToggle = status === 'active' || status === 'inactive'

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="font-display" style={{ fontSize: 'var(--fs-md)', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        Notificações Push
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text)' }}>Notificações neste dispositivo</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 4 }}>{labels[status]}</div>
          {status === 'denied' && (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 4 }}>
              Para ativar, permita notificações nas definições do browser para este site.
            </div>
          )}
        </div>
        {canToggle && (
          <button
            onClick={toggle}
            className={status === 'active' ? 'btn' : 'btn btn-gold'}
            style={{ padding: '6px 16px', fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap' }}
          >
            {status === 'active' ? 'Desativar' : 'Ativar'}
          </button>
        )}
      </div>
    </div>
  )
}
