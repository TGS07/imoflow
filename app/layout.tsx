import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ImoFlow CRM',
  description: 'CRM Imobiliário para agências',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  )
}
