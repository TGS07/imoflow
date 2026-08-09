// Service worker mínimo do ImoFlow — apenas para installability (PWA).
// Estratégia network-first; NÃO faz cache de páginas/dados dinâmicos para
// evitar servir conteúdo desatualizado num CRM. Só guarda um fallback offline.

const CACHE = 'imoflow-shell-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL]))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // Só tratamos navegações (HTML). Tudo o resto segue normal para a rede.
  if (request.mode !== 'navigate') return
  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL))
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  const payload = event.data.json()
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: '/icon-192.png',
      data: { link: payload.link },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link
  const urlToOpen = link ? new URL(link, self.location.origin).href : self.location.origin + '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          client.focus()
          client.navigate(urlToOpen)
          return
        }
      }
      return self.clients.openWindow(urlToOpen)
    })
  )
})
