// components/help/HelpButton.tsx
// Botão "?" discreto para o cabeçalho de cada página — abre a secção do
// manual correspondente em /help?page=<sectionKey>.
import Link from 'next/link'

export function HelpButton({ section }: { section: string }) {
  return (
    <Link
      href={`/help?page=${section}`}
      title="Ajuda desta página"
      aria-label="Ajuda desta página"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        border: '1px solid var(--border)', background: 'var(--card)',
        color: 'var(--muted)', fontSize: 13, fontWeight: 600,
        textDecoration: 'none', fontFamily: 'Jost, sans-serif', lineHeight: 1,
        verticalAlign: 'middle', marginLeft: 6,
      }}
    >
      ?
    </Link>
  )
}
