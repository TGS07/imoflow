'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { LayoutToggle } from './LayoutToggle'
import { createClient } from '@/lib/supabase/client'

const mainNavItems: { href: string; icon: IconName; label: string; badge?: 'pipeline' | 'recs' | 'new' }[] = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/pipeline', icon: 'pipeline', label: 'Pipeline', badge: 'pipeline' },
  { href: '/leads', icon: 'leads', label: 'Leads' },
  { href: '/people', icon: 'people', label: 'Contactos' },
]

const managementNavItems: { href: string; icon: IconName; label: string; badge?: 'recs' | 'new' }[] = [
  { href: '/activities', icon: 'calendar', label: 'Atividades' },
  { href: '/properties', icon: 'home', label: 'Imóveis' },
  { href: '/reports', icon: 'chart', label: 'Relatórios', badge: 'new' },
]

const settingsSubItems: { href: string; icon: IconName; label: string }[] = [
  { href: '/settings/pipeline', icon: 'pipeline', label: 'Pipeline' },
  { href: '/settings/automations', icon: 'robot', label: 'Automações' },
  { href: '/settings/forms', icon: 'form', label: 'Formulários' },
  { href: '/settings/templates', icon: 'template', label: 'Templates' },
  { href: '/settings/agency', icon: 'building', label: 'Agência' },
  { href: '/settings/team', icon: 'team', label: 'Equipa' },
  { href: '/settings/billing', icon: 'credit-card', label: 'Faturação' },
]

type Props = {
  userName: string
  userEmail: string
  userInitials: string
  userRole: 'admin' | 'agent'
  userTheme: 'light' | 'dark'
}

export function SidebarNav({ userName, userInitials, userRole, userTheme }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMac, setIsMac] = useState(true)
  const [pendingRecs, setPendingRecs] = useState(0)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(() => pathname.startsWith('/settings'))
  const [loggingOut, setLoggingOut] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent))
  }, [])

  useEffect(() => {
    fetch('/api/recommendations/count')
      .then(r => r.json())
      .then(d => setPendingRecs(d.count ?? 0))
      .catch(() => {})
  }, [pathname])

  useEffect(() => {
    if (pathname.startsWith('/settings')) setSettingsOpen(true)
  }, [pathname])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as HTMLElement)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const openSearch = () => window.dispatchEvent(new CustomEvent('imoflow:open-cmdk'))

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const inSettings = pathname.startsWith('/settings')

  function renderNavItem(item: { href: string; icon: IconName; label: string; badge?: string }, small?: boolean) {
    const active = isActive(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`sv2-item${small ? ' sv2-item-sub' : ''}${active ? ' active' : ''}`}
      >
        <Icon name={item.icon} size={small ? 15 : 18} />
        <span>{item.label}</span>
        {item.badge === 'recs' && pendingRecs > 0 && (
          <span className="sv2-badge">{pendingRecs > 9 ? '9+' : pendingRecs}</span>
        )}
        {item.badge === 'new' && (
          <span className="sv2-badge-new">novo</span>
        )}
      </Link>
    )
  }

  return (
    <aside className="sidebar-v2" aria-label="Navegação principal">
      {/* Brand */}
      <Link href="/dashboard" className="sv2-brand">
        <div className="sv2-brand-mark">IF</div>
        <span className="sv2-brand-name">ImoFlow</span>
      </Link>

      {/* Search trigger */}
      <button className="sv2-search" onClick={openSearch}>
        <Icon name="search" size={15} />
        <span>Pesquisar…</span>
        <kbd>{isMac ? '⌘' : 'Ctrl'}K</kbd>
      </button>

      {/* Main nav — no group label */}
      <nav className="sv2-nav">
        {mainNavItems.map(item => renderNavItem(item))}
      </nav>

      {/* Gestão group */}
      <div className="sv2-section">
        <div className="sv2-section-label">Gestão</div>
        {managementNavItems.map(item => renderNavItem(item))}
      </div>

      {/* Configurações (admin only) */}
      {userRole === 'admin' && (
        <div className="sv2-section">
          <div className="sv2-section-label">Configurações</div>
          <button
            className={`sv2-item sv2-settings-toggle${inSettings ? ' active' : ''}`}
            onClick={() => setSettingsOpen(o => !o)}
            aria-expanded={settingsOpen}
          >
            <Icon name="settings" size={18} />
            <span>Definições</span>
            <svg
              className={`sv2-chevron${settingsOpen ? ' open' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          {settingsOpen && (
            <div className="sv2-submenu">
              {settingsSubItems.map(item => renderNavItem(item, true))}
            </div>
          )}
        </div>
      )}

      {/* Bottom area */}
      <div className="sv2-bottom">
        <div className="sv2-bottom-actions">
          <NotificationBell />
          <ThemeToggle initialTheme={userTheme} />
        </div>

        {/* User */}
        <div className="sv2-user-wrap" ref={userMenuRef}>
          <button
            className="sv2-user"
            onClick={() => setUserMenuOpen(o => !o)}
            aria-label={`Perfil de ${userName}`}
          >
            <div className="sv2-avatar">{userInitials}</div>
            <div className="sv2-user-info">
              <span className="sv2-user-name">{userName}</span>
              <span className="sv2-user-role">{userRole === 'admin' ? 'Administrador' : 'Agente'}</span>
            </div>
            <Icon name="chevron-down" size={14} />
          </button>

          {userMenuOpen && (
            <div className="sv2-user-menu">
              <Link href="/profile" className="sv2-menu-item" onClick={() => setUserMenuOpen(false)}>
                <Icon name="user" size={16} /> Perfil
              </Link>
              <LayoutToggle initialLayout="sidebar" />
              <Link href="/help" className="sv2-menu-item" onClick={() => setUserMenuOpen(false)}>
                <Icon name="help" size={16} /> Ajuda e suporte
              </Link>
              <div className="sv2-menu-sep" />
              <button
                className="sv2-menu-item sv2-menu-danger"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <Icon name="logout" size={16} />
                {loggingOut ? 'A sair…' : 'Sair da conta'}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
