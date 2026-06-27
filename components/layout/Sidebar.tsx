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
    <aside className={`sidebar-desktop${isOpen ? ' open' : ''}`} style={{ width: 240, minHeight: '100vh', background: '#FFFFFF', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #EEF1F5', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="font-display" style={{ fontSize: 21, background: 'linear-gradient(120deg, #B07D2E, #8B6F30)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            ImoFlow
          </div>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: '#94A3B8', textTransform: 'uppercase', marginTop: 2 }}>CRM Imobiliário</div>
        </div>
        {onClose && (
          <button
            className="mobile-menu-btn"
            onClick={onClose}
            aria-label="Fechar menu"
            style={{ marginTop: 2, borderColor: '#E2E8F0', color: '#64748B' }}
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
              <div style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#94A3B8', padding: '0 20px', marginBottom: 4, marginTop: 20 }}>{section}</div>
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
                      fontWeight: active ? 600 : 400,
                      color: active ? '#B07D2E' : '#475569',
                      background: active ? 'rgba(176,125,46,0.10)' : 'transparent',
                      borderLeft: `2px solid ${active ? '#B07D2E' : 'transparent'}`,
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.background = '#F1F5F9' } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent' } }}
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

      <div style={{ padding: '16px 20px', borderTop: '1px solid #EEF1F5', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #C9A84C, #8B6F30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#FFFFFF', flexShrink: 0 }}>
          {userInitials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
          <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'capitalize' }}>{userRole === 'admin' ? 'Administrador' : 'Consultor'}</div>
        </div>
      </div>
    </aside>
  )
}
