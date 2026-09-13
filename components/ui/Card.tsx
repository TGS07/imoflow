import type { ReactNode, HTMLAttributes } from 'react'

type CardVariant = 'default' | 'stat' | 'highlight' | 'interactive'

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant
  children: ReactNode
}

export function Card({ variant = 'default', children, className, ...rest }: Props) {
  const variantClass = variant === 'interactive' ? ' card-hover' : variant !== 'default' ? ` card-${variant}` : ''
  return (
    <div className={`card${variantClass}${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </div>
  )
}

type StatCardProps = {
  label: string
  value: string | number
  change?: { value: string; positive: boolean }
  icon?: ReactNode
  highlight?: boolean
}

export function StatCard({ label, value, change, icon, highlight }: StatCardProps) {
  return (
    <Card variant={highlight ? 'highlight' : 'stat'} style={highlight ? { background: 'var(--gold-gradient)', color: '#fff' } : undefined}>
      <div style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <span className="section-label" style={highlight ? { color: 'rgba(255,255,255,0.7)' } : undefined}>{label}</span>
          {icon}
        </div>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>{value}</div>
        {change && (
          <span className={`badge badge-${change.positive ? 'green' : 'red'}`} style={{ marginTop: 'var(--space-2)' }}>
            {change.positive ? '↑' : '↓'} {change.value}
          </span>
        )}
      </div>
    </Card>
  )
}
