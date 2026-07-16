import { Icon, IconName } from '@/components/ui/Icon'

type Props = {
  label: string
  value: string | number
  change?: string
  changeUp?: boolean
  icon: IconName
  hint?: string
}

export function StatCard({ label, value, change, changeUp, icon, hint }: Props) {
  return (
    <div className="card card-hover" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(to right, transparent, var(--gold-bright), transparent)', opacity: 0.45 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="section-label">{label}</div>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--gold-glow)', border: '1px solid rgba(176,125,46,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', flexShrink: 0 }}>
          <Icon name={icon} size={15} />
        </div>
      </div>
      <div className="font-display" style={{ fontSize: 'var(--fs-2xl)', color: 'var(--text)', lineHeight: 1.05 }}>{value}</div>
      {(change || hint) && (
        <div style={{ fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, color: change ? (changeUp ? 'var(--green)' : 'var(--red)') : 'var(--muted)' }}>
          {change ? <>{changeUp ? '↑' : '↓'} {change}</> : hint}
        </div>
      )}
    </div>
  )
}
