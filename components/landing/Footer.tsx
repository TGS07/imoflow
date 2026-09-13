import Link from 'next/link'

export function Footer() {
  return (
    <footer style={{ padding: '32px 24px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <span className="font-display" style={{ fontSize: 'var(--fs-md)', color: 'var(--gold)' }}>ImoFlow</span>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/termos" style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', textDecoration: 'none' }}>Termos de Uso</Link>
          <Link href="/privacidade" style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', textDecoration: 'none' }}>Privacidade</Link>
          <Link href="/documentacao" style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', textDecoration: 'none' }}>Documentação</Link>
        </div>

        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
          © {new Date().getFullYear()} ImoFlow. Todos os direitos reservados.
        </span>
      </div>
    </footer>
  )
}
