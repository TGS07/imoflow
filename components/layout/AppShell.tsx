'use client'
import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { NotificationBell } from './NotificationBell'
import { CommandPalette } from '@/components/CommandPalette'
import { Icon } from '@/components/ui/Icon'

type Props = {
  children: React.ReactNode
  userName: string
  userInitials: string
  userRole: 'admin' | 'agent'
}

export function AppShell({ children, userName, userInitials, userRole }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent))
  }, [])

  const openSearch = () => window.dispatchEvent(new CustomEvent('imoflow:open-cmdk'))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>
      <CommandPalette />
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <Sidebar
        userName={userName}
        userInitials={userInitials}
        userRole={userRole}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="app-main" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          gap: 12,
        }}>
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="5" x2="16" y2="5" />
              <line x1="2" y1="9" x2="16" y2="9" />
              <line x1="2" y1="13" x2="16" y2="13" />
            </svg>
          </button>
          <button className="search-trigger" onClick={openSearch} style={{ marginLeft: 'auto' }} aria-label="Pesquisar">
            <Icon name="search" size={14} />
            <span className="hide-mobile">Pesquisar…</span>
            <kbd className="hide-mobile">{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          <NotificationBell />
        </header>
        {children}
      </main>
    </div>
  )
}
