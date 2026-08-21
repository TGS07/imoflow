import type { ReactNode } from 'react'
import Link from 'next/link'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <Link href="/" className="font-display" style={{ fontSize: 20, color: 'var(--gold)', textDecoration: 'none' }}>ImoFlow</Link>
      </header>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 24px' }}>
        {children}
      </main>
      <footer style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
        <Link href="/termos" style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'none' }}>Termos de Uso</Link>
        <Link href="/privacidade" style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'none' }}>Privacidade</Link>
        <Link href="/documentacao" style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'none' }}>Documentação</Link>
      </footer>
    </div>
  )
}
