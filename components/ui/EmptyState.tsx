type Props = {
  illustration?: 'leads' | 'properties' | 'people' | 'search' | 'generic'
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

const ILLUSTRATIONS: Record<NonNullable<Props['illustration']>, React.ReactNode> = {
  leads: (
    <>
      <circle cx="60" cy="44" r="20" fill="var(--gold-glow)" />
      <circle cx="60" cy="44" r="10" stroke="var(--gold)" strokeWidth="2" />
      <circle cx="60" cy="44" r="2.5" fill="var(--gold)" />
      <path d="M28 86c0-12 14-20 32-20s32 8 32 20" stroke="var(--border-strong)" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  properties: (
    <>
      <path d="M34 56 60 34l26 22" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M40 52v30h40V52" stroke="var(--border-strong)" strokeWidth="2" strokeLinejoin="round" />
      <rect x="54" y="64" width="12" height="18" stroke="var(--gold)" strokeWidth="2" />
      <rect x="42" y="40" width="6" height="10" fill="var(--gold-glow)" />
    </>
  ),
  people: (
    <>
      <circle cx="60" cy="42" r="14" fill="var(--gold-glow)" stroke="var(--gold)" strokeWidth="2" />
      <path d="M34 84c0-14 12-22 26-22s26 8 26 22" stroke="var(--border-strong)" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  search: (
    <>
      <circle cx="54" cy="50" r="20" stroke="var(--border-strong)" strokeWidth="2" />
      <path d="m70 66 14 14" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  generic: (
    <>
      <rect x="34" y="40" width="52" height="40" rx="4" fill="var(--gold-glow)" stroke="var(--border-strong)" strokeWidth="2" />
      <path d="M34 52h52M46 40v-6h28v6" stroke="var(--border-strong)" strokeWidth="2" />
    </>
  ),
}

export function EmptyState({ illustration = 'generic', title, description, action }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', animation: 'fadeUp 0.4s var(--ease) both' }}>
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true" style={{ marginBottom: 18 }}>
        {ILLUSTRATIONS[illustration]}
      </svg>
      <div className="font-display" style={{ fontSize: 17, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
      {description && (
        <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 320, lineHeight: 1.6, margin: 0 }}>{description}</p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn btn-primary" style={{ marginTop: 18 }}>
          {action.label}
        </button>
      )}
    </div>
  )
}
