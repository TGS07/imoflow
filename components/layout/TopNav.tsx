'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { createClient } from '@/lib/supabase/client'

const navItems: { href: string; icon: IconName; label: string }[] = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/pipeline', icon: 'pipeline', label: 'Pipeline' },
  { href: '/activities', icon: 'calendar', label: 'Atividades' },
  { href: '/people', icon: 'people', label: 'Contactos' },
  { href: '/properties', icon: 'home', label: 'Imóveis' },
  { href: '/recommendations', icon: 'sparkle', label: 'Recomendações' },
  { href: '/reports', icon: 'chart', label: 'Relatórios' },
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
  const [searchFocused, setSearchFocused] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const settingsRef = useRef<HTMLDivElement>(null)
  const quickAddRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

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
      if (searchRef.current && !searchRef.current.contains(target)) setSearchFocused(false)
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

  return (
    <>
      {/* ===== PRIMARY BAR ===== */}
      <nav className="topnav-v3" role="navigation" aria-label="Navegação principal">
        <div className="tn3-left">
          <Link href="/dashboard" className="tn3-logo">
            <div className="tn3-logo-mark">IF</div>
            <span className="tn3-logo-text">ImoFlow</span>
            <span className="tn3-logo-version">2.0</span>
          </Link>

          {/* Search */}
          <div className="tn3-search-wrap" ref={searchRef}>
            <button
              className={`tn3-search${searchFocused ? ' focused' : ''}`}
              onClick={() => { setSearchFocused(false); openSearch() }}
              onMouseEnter={() => setSearchFocused(true)}
              onMouseLeave={() => setSearchFocused(false)}
            >
              <Icon name="search" size={14} />
              <span className="tn3-search-text">Pesquisar contactos, imóveis, negócios…</span>
              <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
            </button>

            {searchFocused && (
              <div className="tn3-search-dropdown" onMouseEnter={() => setSearchFocused(true)}>
                <div className="tn3-dd-section">Ações rápidas</div>
                <button className="tn3-search-item" onClick={() => { setSearchFocused(false); router.push('/pipeline?new=1') }}>
                  <Icon name="plus" size={15} />
                  <span>Novo negócio</span>
                  <kbd>N</kbd>
                </button>
                <button className="tn3-search-item" onClick={() => { setSearchFocused(false); router.push('/people?new=1') }}>
                  <Icon name="user-plus" size={15} />
                  <span>Novo contacto</span>
                  <kbd>C</kbd>
                </button>
                <button className="tn3-search-item" onClick={() => { setSearchFocused(false); router.push('/properties?new=1') }}>
                  <Icon name="home-plus" size={15} />
                  <span>Novo imóvel</span>
                  <kbd>I</kbd>
                </button>
                <div className="tn3-dd-foot">
                  <kbd>↑</kbd><kbd>↓</kbd> navegar <kbd>↵</kbd> abrir <kbd>esc</kbd> fechar
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="tn3-right">
          {/* Quick Add */}
          <div className="tn3-dropdown-anchor" ref={quickAddRef}>
            <button
              className="tn3-quick-add-btn"
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

          {/* Settings (admin only) */}
          {userRole === 'admin' && (
            <div className="tn3-dropdown-anchor" ref={settingsRef}>
              <button
                className="tn3-icon-btn"
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

          <ThemeToggle initialTheme={userTheme} />

          <div className="tn3-separator" />

          {/* User Menu */}
          <div className="tn3-dropdown-anchor" ref={userMenuRef}>
            <button
              className="tn3-avatar-wrap"
              onClick={() => setUserMenuOpen(o => !o)}
              aria-label={`Perfil de ${userName}`}
            >
              <div className="tn3-avatar">{userInitials}</div>
              <div className="tn3-avatar-status" />
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
                <Link href="/profile" className="tn3-user-item" onClick={() => setUserMenuOpen(false)}>
                  <Icon name="palette" size={16} /> Aparência
                </Link>
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

      {/* ===== TAB BAR ===== */}
      <div className="tn3-tabs" role="tablist" aria-label="Navegação por secções">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`tn3-tab${active ? ' active' : ''}`}
              role="tab"
              aria-selected={active}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
              {item.href === '/recommendations' && pendingRecs > 0 && (
                <span className="tn3-tab-badge-red">
                  {pendingRecs > 9 ? '9+' : pendingRecs}
                </span>
              )}
              {item.href === '/reports' && (
                <span className="tn3-tab-badge-new">novo</span>
              )}
            </Link>
          )
        })}
      </div>
    </>
  )
}
