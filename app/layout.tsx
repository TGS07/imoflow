import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'

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
    <html lang="pt" data-theme={theme} suppressHydrationWarning>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
