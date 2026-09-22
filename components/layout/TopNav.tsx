'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { LayoutToggle } from './LayoutToggle'
import { createClient } from '@/lib/supabase/client'

const mainNavItems: { href: string; label: string }[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/people', label: 'Contactos' },
]

const moreNavItems: { href: string; icon: IconName; label: string; badge?: 'recs' | 'new' }[] = [
  { href: '/activities', icon: 'calendar', label: 'Atividades' },
  { href: '/properties', icon: 'home', label: 'Imóveis' },
  { href: '/recommendations', icon: 'sparkle', label: 'Recomendações', badge: 'recs' },
  { href: '/reports', icon: 'chart', label: 'Relatórios', badge: 'new' },
]

const settingsItems: { href: string; icon: IconName; label: string; colorClass: string }[] = [
  { href: '/settings/pipeline', icon: 'pipeline', label: 'Pipeline', colorClass: 'si-gold' },
  { href: '/settings/automations', icon: 'robot', label: 'Automações', colorClass: 'si-purple' },
  { href: '/settings/forms', icon: 'form', label: 'Formulários', colorClass: 'si-blue' },
  { href: '/settings/templates', icon: 'template', label: 'Templates', colorClass: 'si-green' },
  { href: '/settings/agency', icon: 'building', label: 'Agência', colorClass: 'si-amber' },
  { href: '/settings/team', icon: 'team', label: 'Equipa', colorClass: 'si-red' },
  { href: '/settings/billing', icon: 'credit-card', label: 'Faturação', colorClass: 'si-gold' },
]

const quickAddItems: { href: string; icon: IconName; label: string; colorClass: string }[] = [
  { href: '/pipeline?new=1', icon: 'pipeline', label: 'Novo negócio', colorClass: 'qi-deal' },
  { href: '/people?new=1', icon: 'user-plus', label: 'Novo contacto', colorClass: 'qi-contact' },
  { href: '/properties?new=1', icon: 'home-plus', label: 'Novo imóvel', colorClass: 'qi-prop' },
  { href: '/activities?new=1', icon: 'calendar-plus', label: 'Nova atividade', colorClass: 'qi-act' },
]

type Props = {
  userName: string
  userEmail: string
  userInitials: string
  userRole: 'admin' | 'agent'
  userTheme: 'light' | 'dark'
}

export function TopNav({ userName, userEmail, userInitials, userRole, userTheme }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMac, setIsMac] = useState(true)
  const [pendingRecs, setPendingRecs] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const settingsRef = useRef<HTMLDivElement>(null)
  const quickAddRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)

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
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (settingsRef.current && !settingsRef.current.contains(target)) setSettingsOpen(false)
      if (quickAddRef.current && !quickAddRef.current.contains(target)) setQuickAddOpen(false)
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false)
      if (moreRef.current && !moreRef.current.contains(target)) setMoreOpen(false)
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

  const moreIsActive = moreNavItems.some(item => isActive(item.href))

  return (
    <nav className="app-header" role="navigation" aria-label="Navegação principal">
      {/* Left: logo + search */}
      <div className="ah-left">
        <Link href="/dashboard" className="ah-logo" aria-label="ImoFlow">
          <div className="ah-logo-mark">IF</div>
        </Link>

        <button className="ah-search" onClick={openSearch}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <span className="ah-search-text">Pesquisar contactos, imóveis…</span>
          <kbd className="ah-search-kbd">{isMac ? '⌘' : 'Ctrl'}K</kbd>
        </button>
      </div>

      {/* Center-right: segmented nav */}
      <div className="ah-right">
        <div className="ah-segmented" role="tablist" aria-label="Navegação por secções">
          {mainNavItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`ah-seg-item${isActive(item.href) ? ' active' : ''}`}
              role="tab"
              aria-selected={isActive(item.href)}
            >
              {item.label}
            </Link>
          ))}
          {/* More dropdown */}
          <div className="ah-seg-more-wrap" ref={moreRef}>
            <button
              className={`ah-seg-item ah-seg-more${moreIsActive ? ' active' : ''}`}
              onClick={() => setMoreOpen(o => !o)}
              aria-label="Mais páginas"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
              </svg>
            </button>
            {moreOpen && (
              <div className="ah-more-dropdown">
                {moreNavItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`ah-more-item${isActive(item.href) ? ' active' : ''}`}
                    onClick={() => setMoreOpen(false)}
                  >
                    <Icon name={item.icon} size={16} />
                    <span>{item.label}</span>
                    {item.badge === 'recs' && pendingRecs > 0 && (
                      <span className="ah-more-badge-red">{pendingRecs > 9 ? '9+' : pendingRecs}</span>
                    )}
                    {item.badge === 'new' && (
                      <span className="ah-more-badge-new">novo</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Add */}
        <div className="tn3-dropdown-anchor" ref={quickAddRef}>
          <button
            className="ah-icon-btn ah-quick-add"
            onClick={() => setQuickAddOpen(o => !o)}
            aria-label="Criar novo"
          >
            <Icon name="plus" size={17} />
          </button>
          {quickAddOpen && (
            <div className="tn3-dropdown-panel tn3-qa-panel">
              {quickAddItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="tn3-qa-item"
                  onClick={() => setQuickAddOpen(false)}
                >
                  <span className={`tn3-qa-icon ${item.colorClass}`}>
                    <Icon name={item.icon} size={17} />
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <NotificationBell />
        <ThemeToggle initialTheme={userTheme} />

        {/* Settings (admin only) */}
        {userRole === 'admin' && (
          <div className="tn3-dropdown-anchor" ref={settingsRef}>
            <button
              className="ah-icon-btn"
              onClick={() => setSettingsOpen(o => !o)}
              aria-label="Definições"
            >
              <Icon name="settings" size={17} />
            </button>
            {settingsOpen && (
              <div className="tn3-dropdown-panel tn3-settings-panel">
                <div className="tn3-dd-header">Definições</div>
                <div className="tn3-settings-grid">
                  {settingsItems.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="tn3-settings-item"
                      onClick={() => setSettingsOpen(false)}
                    >
                      <span className={`tn3-settings-icon ${item.colorClass}`}>
                        <Icon name={item.icon} size={18} />
                      </span>
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="tn3-dd-footer-hint">
                  <Icon name="keyboard" size={13} />
                  Atalhos: <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>+<kbd>,</kbd> para definições
                </div>
              </div>
            )}
          </div>
        )}

        <div className="ah-separator" />

        {/* User Menu */}
        <div className="tn3-dropdown-anchor" ref={userMenuRef}>
          <button
            className="ah-avatar-wrap"
            onClick={() => setUserMenuOpen(o => !o)}
            aria-label={`Perfil de ${userName}`}
          >
            <div className="ah-avatar">{userInitials}</div>
          </button>
          {userMenuOpen && (
            <div className="tn3-dropdown-panel tn3-user-panel">
              <div className="tn3-user-header">
                <div className="tn3-user-avatar">
                  {userInitials}
                  <div className="tn3-user-avatar-status" />
                </div>
                <div className="tn3-user-info">
                  <span className="tn3-user-name">{userName}</span>
                  <span className="tn3-user-email">{userEmail}</span>
                  <span className="tn3-user-plan">
                    <Icon name="crown" size={10} /> Pro
                  </span>
                </div>
              </div>
              <Link href="/profile" className="tn3-user-item" onClick={() => setUserMenuOpen(false)}>
                <Icon name="user" size={16} /> Perfil
                <span className="tn3-user-item-hint">{isMac ? '⌘' : 'Ctrl'}P</span>
              </Link>
              <LayoutToggle initialLayout="topbar" />
              <Link href="/help" className="tn3-user-item" onClick={() => setUserMenuOpen(false)}>
                <Icon name="help" size={16} /> Ajuda e suporte
              </Link>
              <div className="tn3-user-sep" />
              <button
                className="tn3-user-item tn3-user-danger"
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
    </nav>
  )
}
