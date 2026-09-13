'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'

const mainTabs: { href: string; icon: IconName; label: string }[] = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/pipeline', icon: 'pipeline', label: 'Pipeline' },
  { href: '/activities', icon: 'calendar', label: 'Atividades' },
  { href: '/people', icon: 'people', label: 'Contactos' },
]

const moreItems: { href: string; icon: IconName; label: string; adminOnly?: boolean }[] = [
  { href: '/properties', icon: 'home', label: 'Imóveis' },
  { href: '/reports', icon: 'chart', label: 'Relatórios' },
  { href: '/settings/pipeline', icon: 'settings', label: 'Definições', adminOnly: true },
  { href: '/help', icon: 'help', label: 'Ajuda' },
]

type Props = {
  userRole: 'admin' | 'agent'
}

export function MobileNav({ userRole }: Props) {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  const isActiveMore = moreItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )

  const visibleMoreItems = moreItems.filter((item) => !item.adminOnly || userRole === 'admin')

  return (
    <>
      <div className="mobile-nav">
        <div className="mobile-nav-tabs">
          {mainTabs.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`mobile-nav-tab${active ? ' active' : ''}`}
              >
                <Icon name={tab.icon} size={20} />
                {tab.label}
              </Link>
            )
          })}
          <button
            className={`mobile-nav-tab${isActiveMore || sheetOpen ? ' active' : ''}`}
            onClick={() => setSheetOpen(true)}
            aria-label="Mais opções"
          >
            <Icon name="chevron-down" size={20} />
            Mais
          </button>
        </div>
      </div>

      {sheetOpen && (
        <div className="mobile-more-sheet" role="dialog" aria-label="Mais opções">
          <div
            className="mobile-more-backdrop"
            onClick={() => setSheetOpen(false)}
          />
          <div className="mobile-more-content">
            <div style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'var(--border-strong)',
              margin: '0 auto 16px',
            }} />
            {visibleMoreItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSheetOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 8px',
                    fontSize: 15,
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--gold)' : 'var(--text)',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'background 0.12s ease',
                  }}
                >
                  <Icon name={item.icon} size={20} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
