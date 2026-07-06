'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, IconName } from '@/components/ui/Icon'

type NavItem = { label: string; href: string; icon: IconName; keywords?: string }
type LeadHit = { id: string; name: string; phone: string | null; email: string | null }

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard', keywords: 'inicio home painel' },
  { label: 'Leads', href: '/leads', icon: 'leads', keywords: 'clientes contactos negocios' },
  { label: 'Pipeline', href: '/pipeline', icon: 'pipeline', keywords: 'funil kanban etapas' },
  { label: 'Contactos', href: '/people', icon: 'people', keywords: 'contactos pessoas' },
  { label: 'Organizações', href: '/organizations', icon: 'building', keywords: 'empresas organizacoes' },
  { label: 'Imóveis', href: '/properties', icon: 'home', keywords: 'propriedades casas imoveis' },
  { label: 'Atividades', href: '/activities', icon: 'calendar', keywords: 'calendario tarefas agenda' },
  { label: 'Relatórios', href: '/reports', icon: 'chart', keywords: 'estatisticas metricas relatorios' },
  { label: 'Configurações do Pipeline', href: '/settings/pipeline', icon: 'settings', keywords: 'etapas campos definicoes' },
  { label: 'Automações', href: '/settings/automations', icon: 'zap', keywords: 'regras automatico' },
  { label: 'Formulários', href: '/settings/forms', icon: 'form', keywords: 'forms captura' },
  { label: 'Templates', href: '/settings/templates', icon: 'mail', keywords: 'emails modelos whatsapp' },
  { label: 'Agência', href: '/settings/agency', icon: 'building', keywords: 'remetente definicoes' },
  { label: 'Equipa', href: '/settings/team', icon: 'team', keywords: 'utilizadores consultores' },
]

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [leads, setLeads] = useState<LeadHit[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Atalho global Cmd/Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('imoflow:open-cmdk', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('imoflow:open-cmdk', onOpen)
    }
  }, [])

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setQuery('')
      setLeads([])
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // Pesquisa de leads (debounce)
  useEffect(() => {
    if (!open || query.trim().length < 2) { setLeads([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads?search=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setLeads((Array.isArray(data) ? data : []).slice(0, 6).map((l: LeadHit) => ({ id: l.id, name: l.name, phone: l.phone, email: l.email })))
        }
      } catch { setLeads([]) }
    }, 220)
    return () => clearTimeout(t)
  }, [query, open])

  const filteredNav = query.trim()
    ? NAV.filter(n => norm(n.label + ' ' + (n.keywords ?? '')).includes(norm(query)))
    : NAV

  type Row = { type: 'nav'; item: NavItem } | { type: 'lead'; item: LeadHit }
  const rows: Row[] = [
    ...filteredNav.map(item => ({ type: 'nav' as const, item })),
    ...leads.map(item => ({ type: 'lead' as const, item })),
  ]

  const go = useCallback((row: Row) => {
    setOpen(false)
    if (row.type === 'nav') router.push(row.item.href)
    else router.push(`/leads/${row.item.id}`)
  }, [router])

  useEffect(() => { setActive(0) }, [query, leads.length])

  if (!open) return null

  return (
    <div className="cmdk-backdrop" onClick={() => setOpen(false)}>
      <div className="cmdk" onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, rows.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && rows[active]) { e.preventDefault(); go(rows[active]) }
        }}>
        <div className="cmdk-input-wrap">
          <Icon name="search" size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Pesquisar páginas, leads…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className="cmdk-esc">ESC</kbd>
        </div>
        <div className="cmdk-list">
          {rows.length === 0 && (
            <div className="cmdk-empty">Sem resultados para “{query}”.</div>
          )}
          {filteredNav.length > 0 && (
            <div className="cmdk-section">Ir para</div>
          )}
          {rows.map((row, i) => {
            const isActive = i === active
            if (row.type === 'nav') {
              return (
                <button key={'n' + row.item.href} className={`cmdk-row${isActive ? ' active' : ''}`}
                  onMouseEnter={() => setActive(i)} onClick={() => go(row)}>
                  <Icon name={row.item.icon} size={15} style={{ flexShrink: 0, opacity: 0.7 }} />
                  <span>{row.item.label}</span>
                </button>
              )
            }
            // primeiro lead: mostra cabeçalho de secção
            const prev = rows[i - 1]
            const showHeader = !prev || prev.type !== 'lead'
            return (
              <div key={'l' + row.item.id}>
                {showHeader && <div className="cmdk-section">Leads</div>}
                <button className={`cmdk-row${isActive ? ' active' : ''}`}
                  onMouseEnter={() => setActive(i)} onClick={() => go(row)}>
                  <Icon name="leads" size={15} style={{ flexShrink: 0, opacity: 0.7 }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.item.name}</span>
                  <span className="cmdk-hint">{row.item.phone ?? row.item.email ?? ''}</span>
                </button>
              </div>
            )
          })}
        </div>
        <div className="cmdk-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>⌘</kbd><kbd>K</kbd> alternar</span>
        </div>
      </div>
    </div>
  )
}
