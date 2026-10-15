const CACHE_NAME = 'ruang-iman-shell-v2'

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const response = await fetch('/')
    if (!response.ok) throw new Error(`Gagal mengambil aplikasi: ${response.status}`)
    const html = await response.clone().text()
    await cache.put('/', response)
    await cache.put('/index.html', new Response(html, { headers: { 'Content-Type': 'text/html' } }))
    const assets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)]
      .map((match) => new URL(match[1], self.location.origin).href)
    await Promise.all(assets.map(async (url) => {
      const asset = await fetch(url)
      if (!asset.ok) throw new Error(`Gagal menyimpan aset aplikasi: ${url}`)
      await cache.put(url, asset)
    }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('ruang-iman-') && key !== CACHE_NAME).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put('/', response.clone())
        }
        return response
      } catch {
        return (await caches.match(request)) || (await caches.match('/')) || (await caches.match('/index.html'))
      }
    })())
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreVary: true })
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME)
        await cache.put(request, response.clone())
      }
      return response
    })())
  }
})
