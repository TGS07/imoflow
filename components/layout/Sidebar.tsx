'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, IconName } from '@/components/ui/Icon'

const navItems: { href: string; icon: IconName; label: string; section: string }[] = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard', section: 'Principal' },
  { href: '/leads', icon: 'leads', label: 'Leads', section: 'Principal' },
  { href: '/pipeline', icon: 'pipeline', label: 'Pipeline', section: 'Principal' },
  { href: '/people', icon: 'people', label: 'Pessoas', section: 'Principal' },
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
    <aside className={`sidebar-desktop${isOpen ? ' open' : ''}`} style={{ width: 240, minHeight: '100vh', background: '#111318', borderRight: '1px solid #1E2028', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #1E2028', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="font-display" style={{ fontSize: 21, background: 'linear-gradient(120deg, #E0C26A, #C9A84C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            ImoFlow
          </div>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: '#4B5563', textTransform: 'uppercase', marginTop: 2 }}>CRM Imobiliário</div>
        </div>
        {onClose && (
          <button
            className="mobile-menu-btn"
            onClick={onClose}
            aria-label="Fechar menu"
            style={{ marginTop: 2, borderColor: '#1E2028', color: '#9CA3AF' }}
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
              <div style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#374151', padding: '0 20px', marginBottom: 4, marginTop: 20 }}>{section}</div>
              {sectionItems.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 20px',
                      fontSize: 13,
                      fontWeight: active ? 500 : 400,
                      color: active ? '#E0C26A' : '#9CA3AF',
                      background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
                      borderLeft: `2px solid ${active ? '#C9A84C' : 'transparent'}`,
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#E2E8F0'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent' } }}
                  >
                    <Icon name={item.icon} size={15} style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div style={{ padding: '16px 20px', borderTop: '1px solid #1E2028', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #C9A84C, #8B6F30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
          {userInitials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
          <div style={{ fontSize: 10, color: '#4B5563', textTransform: 'capitalize' }}>{userRole === 'admin' ? 'Administrador' : 'Consultor'}</div>
        </div>
      </div>
    </aside>
  )
}
