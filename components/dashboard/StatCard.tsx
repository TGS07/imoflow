type Props = {
  label: string
  value: string | number
  change?: string
  changeUp?: boolean
  icon: string
}

export function StatCard({ label, value, change, changeUp, icon }: Props) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(to right, transparent, var(--gold-dim), transparent)', opacity: 0.5 }} />
      <div style={{ position: 'absolute', top: 18, right: 18, fontSize: 22, opacity: 0.2 }}>{icon}</div>
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
