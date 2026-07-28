'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, IconName } from '@/components/ui/Icon'

const navItems: { href: string; icon: IconName; label: string; section: string }[] = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard', section: 'Principal' },
  { href: '/leads', icon: 'leads', label: 'Leads', section: 'Principal' },
  { href: '/pipeline', icon: 'pipeline', label: 'Pipeline', section: 'Principal' },
  { href: '/people', icon: 'people', label: 'Contactos', section: 'Principal' },
  { href: '/organizations', icon: 'building', label: 'Organizações', section: 'Principal' },
  { href: '/properties', icon: 'home', label: 'Imóveis', section: 'Principal' },
  { href: '/activities', icon: 'calendar', label: 'Atividades', section: 'Principal' },
  { href: '/reports', icon: 'chart', label: 'Relatórios', section: 'Principal' },
  { href: '/settings/pipeline', icon: 'settings', label: 'Configurações', section: 'Sistema' },
  { href: '/settings/automations', icon: 'zap', label: 'Automações', section: 'Sistema' },
  { href: '/settings/forms', icon: 'form', label: 'Formulários', section: 'Sistema' },
  { href: '/settings/templates', icon: 'mail', label: 'Templates', section: 'Sistema' },
  { href: '/settings/agency', icon: 'building', label: 'Agência', section: 'Sistema' },
  { href: '/settings/team', icon: 'team', label: 'Equipa', section: 'Sistema' },
  { href: '/help', icon: 'help', label: 'Ajuda', section: 'Sistema' },
]

type Props = {
  userName: string
  userInitials: string
  userRole: 'admin' | 'agent'
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ userName, userInitials, userRole, isOpen, onClose }: Props) {
  const pathname = usePathname()

  const visibleItems = navItems.filter(item => item.section !== 'Sistema' || userRole === 'admin')

  return (
    <aside className={`sidebar-desktop${isOpen ? ' open' : ''}`} style={{ width: 240, minHeight: '100vh', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="font-display" style={{ fontSize: 21, background: 'linear-gradient(120deg, #B07D2E, #8B6F30)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            ImoFlow
          </div>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: 2, opacity: 0.8 }}>CRM Imobiliário</div>
        </div>
        {onClose && (
          <button
            className="mobile-menu-btn"
            onClick={onClose}
            aria-label="Fechar menu"
            style={{ marginTop: 2, borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="2" x2="14" y2="14" />
              <line x1="14" y1="2" x2="2" y2="14" />
            </svg>
          </button>
        )}
      </div>

      <nav style={{ padding: '16px 0', flex: 1, overflowY: 'auto' }}>
        {['Principal', 'Sistema'].map(section => {
          const sectionItems = visibleItems.filter(item => item.section === section)
          if (sectionItems.length === 0) return null
          return (
            <div key={section}>
              <div style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--muted)', opacity: 0.75, padding: '0 20px', marginBottom: 4, marginTop: 20 }}>{section}</div>
              {sectionItems.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`sidebar-link${active ? ' active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 20px',
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      textDecoration: 'none',
                    }}
                  >
                    <Icon name={item.icon} size={15} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <Link href="/profile" onClick={onClose} style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #C9A84C, #8B6F30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#FFFFFF', flexShrink: 0, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}>
          {userInitials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'capitalize' }}>{userRole === 'admin' ? 'Administrador' : 'Consultor'}</div>
        </div>
      </Link>
    </aside>
  )
}
