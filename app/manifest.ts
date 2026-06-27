import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ImoFlow — CRM Imobiliário',
    short_name: 'ImoFlow',
    description: 'CRM e automações para agências imobiliárias',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F4F6F9',
    theme_color: '#0F0F12',
    lang: 'pt',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
