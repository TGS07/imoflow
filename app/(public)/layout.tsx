import type { ReactNode } from 'react'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="font-display" style={{ fontSize: 20, color: 'var(--gold)' }}>ImoFlow</div>
      </header>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 24px' }}>
        {children}
      </main>
    </div>
  )
}
