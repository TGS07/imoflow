'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  pipeline: 'Pipeline',
  activities: 'Atividades',
  people: 'Contactos',
  properties: 'Imóveis',
  reports: 'Relatórios',
  leads: 'Leads',
  organizations: 'Organizações',
  settings: 'Definições',
  profile: 'Perfil',
  recommendations: 'Recomendações',
  help: 'Ajuda',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ID_RE = /^[0-9a-f]{20,}$|^\d+$/

function isDynamicSegment(segment: string): boolean {
  return UUID_RE.test(segment) || ID_RE.test(segment)
}

type Props = {
  title?: string
}

export function Breadcrumbs({ title }: Props) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  // Show only on detail pages (3+ segments)
  if (segments.length < 3) return null

  const crumbs = segments.map((segment, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    const isLast = i === segments.length - 1
    let label: string

    if (isDynamicSegment(segment)) {
      label = isLast && title ? title : 'Detalhe'
    } else {
      label = SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1)
    }

    return { href, label, isLast }
  })

  return (
    <div className="breadcrumbs" aria-label="Breadcrumbs">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span className="breadcrumbs-sep" aria-hidden="true">/</span>}
          {crumb.isLast ? (
            <span className="breadcrumbs-current">{crumb.label}</span>
          ) : (
            <Link href={crumb.href}>{crumb.label}</Link>
          )}
        </span>
      ))}
    </div>
  )
}
