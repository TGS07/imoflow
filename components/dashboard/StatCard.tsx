import { Icon, IconName } from '@/components/ui/Icon'

type Props = {
  label: string
  value: string | number
  change?: string
  changeUp?: boolean
  icon: IconName
}

export function StatCard({ label, value, change, changeUp, icon }: Props) {
  return (
    <div className="card card-hover" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(to right, transparent, var(--gold-dim), transparent)', opacity: 0.5 }} />
      <div style={{ position: 'absolute', top: 18, right: 18, color: 'var(--gold)', opacity: 0.25 }}>
        <Icon name={icon} size={22} />
      </div>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 32, color: 'var(--text)', lineHeight: 1, marginBottom: 8 }}>{value}</div>
      {change && (
        <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: changeUp ? 'var(--green)' : 'var(--red)' }}>
          {changeUp ? '↑' : '↓'} {change}
        </div>
      )}
    </div>
  )
}
