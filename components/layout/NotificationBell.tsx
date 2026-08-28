'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'new_lead' | 'task_due' | 'lead_stage_changed' | 'email_received'
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

const TYPE_ICONS: Record<Notification['type'], string> = {
  new_lead: '👤',
  task_due: '📋',
  lead_stage_changed: '🔄',
  email_received: '✉️',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora mesmo'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  return `há ${Math.floor(hours / 24)}d`
}

export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } catch {
      // silencioso
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function markAsRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  async function markAllAsRead() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.read) await markAsRead(n.id)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="notification-bell-btn"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: open ? 'var(--gold-glow)' : 'transparent',
          border: open ? '1px solid rgba(176,125,46,0.25)' : '1px solid transparent',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          transition: 'all 0.15s ease',
        }}
        aria-label="Notificações"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            background: '#DC2626',
            color: '#FFFFFF',
            borderRadius: 20,
            fontSize: 9,
            fontWeight: 700,
            minWidth: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid var(--surface)',
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          right: 12,
          top: 52,
          width: 'min(360px, calc(100vw - 24px))',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 16px 48px rgba(60,44,18,0.14), 0 4px 12px rgba(60,44,18,0.06)',
          zIndex: 50,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Notificações</span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #C9A84C, #8B6F30)',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '2px 7px',
                  minWidth: 18,
                  textAlign: 'center',
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: 'var(--gold)',
                  fontWeight: 500,
                  fontFamily: 'var(--font-body)',
                }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>🔔</div>
                <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
                  Sem notificações de momento
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '14px 18px',
                    width: '100%',
                    textAlign: 'left',
                    background: n.read ? 'transparent' : 'var(--gold-glow)',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: n.read ? 'var(--bg)' : 'rgba(176,125,46,0.12)',
                    border: n.read ? '1px solid var(--border)' : '1px solid rgba(176,125,46,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    flexShrink: 0,
                  }}>
                    {TYPE_ICONS[n.type]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}>
                      <p style={{
                        margin: 0,
                        fontWeight: n.read ? 400 : 600,
                        fontSize: 13,
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {n.title}
                      </p>
                      <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p style={{
                      margin: '3px 0 0',
                      fontSize: 12,
                      color: 'var(--muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.4,
                    }}>
                      {n.body}
                    </p>
                    {!n.read && (
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--gold)',
                        position: 'absolute',
                        right: 18,
                        marginTop: -14,
                      }} />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
