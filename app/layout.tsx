import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Fraunces, Hanken_Grotesk } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'

// Fontes servidas pelo próprio site (sem pedido bloqueante ao Google Fonts)
const fraunces = Fraunces({ subsets: ['latin'], style: ['normal', 'italic'], axes: ['opsz'], variable: '--font-fraunces', display: 'swap' })
const hanken = Hanken_Grotesk({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-hanken', display: 'swap' })

export const metadata: Metadata = {
  title: 'ImoFlow CRM',
  description: 'CRM Imobiliário para agências',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ImoFlow',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#F7F5F0',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')?.value === 'dark' ? 'dark' : 'light'

  return (
    <html lang="pt" data-theme={theme} className={`${fraunces.variable} ${hanken.variable}`} suppressHydrationWarning>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
