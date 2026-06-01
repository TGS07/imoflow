'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: '▦', label: 'Dashboard', section: 'Principal' },
  { href: '/leads', icon: '◎', label: 'Leads', section: 'Principal' },
  { href: '/pipeline', icon: '◈', label: 'Pipeline', section: 'Principal' },
  { href: '/people', icon: '👤', label: 'Pessoas', section: 'Principal' },
  { href: '/organizations', icon: '🏢', label: 'Organizações', section: 'Principal' },
  { href: '/properties', icon: '🏠', label: 'Imóveis', section: 'Principal' },
  { href: '/activities', icon: '📅', label: 'Atividades', section: 'Principal' },
  { href: '/reports', icon: '📊', label: 'Relatórios', section: 'Principal' },
  { href: '/settings/pipeline', icon: '⚙', label: 'Configurações', section: 'Sistema' },
  { href: '/settings/automations', icon: '⚡', label: 'Automações', section: 'Sistema' },
  { href: '/settings/forms', icon: '📋', label: 'Formulários', section: 'Sistema' },
  { href: '/settings/team', icon: '👥', label: 'Equipa', section: 'Sistema' },
]

type Props = {
  userName: string
  userInitials: string
  userRole: 'admin' | 'agent'
}

export function Sidebar({ userName, userInitials, userRole }: Props) {
  const pathname = usePathname()

  const visibleItems = navItems.filter(item => item.section !== 'Sistema' || userRole === 'admin')

  return (
    <aside style={{ width: 240, minHeight: '100vh', background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '28px 0', flexShrink: 0 }}>
      <div style={{ padding: '0 24px 32px', borderBottom: '1px solid var(--border)' }}>
        <div className="font-display" style={{ fontSize: 22, color: 'var(--gold)' }}>ImoFlow</div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: 2 }}>CRM Imobiliário</div>
      </div>

      <nav style={{ padding: '24px 0', flex: 1 }}>
        {['Principal', 'Sistema'].map(section => {
          const sectionItems = visibleItems.filter(item => item.section === section)
          if (sectionItems.length === 0) return null
          return (
            <div key={section}>
              <div style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--muted)', padding: '0 24px', marginBottom: 6, marginTop: 16 }}>{section}</div>
              {sectionItems.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', fontSize: 13, color: active ? 'var(--gold)' : 'var(--muted)', background: active ? 'var(--gold-glow)' : 'transparent', borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent', textDecoration: 'none', transition: 'all 0.2s' }}>
                    <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), var(--gold-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#0D0D0F', flexShrink: 0 }}>
          {userInitials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
        </div>
      </div>
    </aside>
  )
}
