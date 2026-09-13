'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'

const navItems: { href: string; icon: IconName; label: string }[] = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/pipeline', icon: 'pipeline', label: 'Pipeline' },
  { href: '/activities', icon: 'calendar', label: 'Atividades' },
  { href: '/people', icon: 'people', label: 'Contactos' },
  { href: '/properties', icon: 'home', label: 'Imóveis' },
  { href: '/reports', icon: 'chart', label: 'Relatórios' },
]

type Props = {
  userName: string
  userInitials: string
  userRole: 'admin' | 'agent'
  userTheme: 'light' | 'dark'
}

export function TopNav({ userName, userInitials, userRole, userTheme }: Props) {
  const pathname = usePathname()
  const [isMac, setIsMac] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent))
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('.topnav-settings-wrap')) {
        setSettingsOpen(false)
      }
    }
    if (settingsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [settingsOpen])

  const openSearch = () => window.dispatchEvent(new CustomEvent('imoflow:open-cmdk'))

  return (
    <nav className="topnav" role="navigation" aria-label="Navegação principal">
      <div className="topnav-left">
        <Link href="/dashboard" className="topnav-logo">
          <div className="topnav-logo-mark">IF</div>
          <span className="topnav-logo-text">ImoFlow</span>
        </Link>

        <div className="topnav-links">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`topnav-link${active ? ' active' : ''}`}
              >
                <Icon name={item.icon} size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="topnav-right">
        <button className="topnav-search" onClick={openSearch} aria-label="Pesquisar">
          <Icon name="search" size={14} />
          <span>Pesquisar…</span>
          <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
        </button>

        <NotificationBell />

        {userRole === 'admin' && (
          <div className="topnav-settings-wrap" style={{ position: 'relative' }}>
            <button
              className="topnav-icon-btn"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-label="Definições"
            >
              <Icon name="settings" size={16} />
            </button>
            {settingsOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 6,
                width: 200,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: '0 12px 36px rgba(60,44,18,0.14), 0 4px 12px rgba(60,44,18,0.06)',
                zIndex: 60,
                overflow: 'hidden',
              }}>
                {[
                  { href: '/settings/pipeline', label: 'Pipeline' },
                  { href: '/settings/automations', label: 'Automações' },
                  { href: '/settings/forms', label: 'Formulários' },
                  { href: '/settings/templates', label: 'Templates' },
                  { href: '/settings/agency', label: 'Agência' },
                  { href: '/settings/team', label: 'Equipa' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSettingsOpen(false)}
                    style={{
                      display: 'block',
                      padding: '10px 16px',
                      fontSize: 13,
                      color: 'var(--text)',
                      textDecoration: 'none',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <ThemeToggle initialTheme={userTheme} />

        <Link href="/profile" className="topnav-avatar" aria-label={`Perfil de ${userName}`}>
          <div className="avatar-initials">{userInitials}</div>
        </Link>
      </div>
    </nav>
  )
}
