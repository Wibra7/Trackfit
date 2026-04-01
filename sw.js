const CACHE_NAME = 'trackfit-v1'

// Assets to cache on install
const PRECACHE_ASSETS = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
  scheduleGratitudeNotification()
})

// Cache-first for same-origin, network-first for others
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      }).catch(() => cached)
    })
  )
})

// ── Notification scheduling ──────────────────────────────────────
let notifTimer = null

function scheduleGratitudeNotification() {
  if (notifTimer) clearTimeout(notifTimer)

  const now = new Date()
  const target = new Date()
  target.setHours(23, 30, 0, 0)

  // If 23:30 already passed today, schedule for tomorrow
  if (now >= target) target.setDate(target.getDate() + 1)

  const delay = target - now

  notifTimer = setTimeout(async () => {
    // Only fire if user has opted in (stored in IndexedDB / checked via clients)
    const clients = await self.clients.matchAll()
    // Fire notification
    self.registration.showNotification('TrackFit 🙏', {
      body: "What are 3 things you're grateful for today?",
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'gratitude-reminder',
      renotify: true,
      actions: [{ action: 'open', title: 'Log now' }],
    })
    // Schedule next day
    scheduleGratitudeNotification()
  }, delay)
}

// Message from app: re-schedule (called on app open) or cancel
self.addEventListener('message', event => {
  if (event.data === 'SCHEDULE_NOTIF') {
    scheduleGratitudeNotification()
  }
  if (event.data === 'CANCEL_NOTIF') {
    if (notifTimer) clearTimeout(notifTimer)
    notifTimer = null
  }
})

// Notification click: open app to gratitude form
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow('/?openGratitude=1')
    })
  )
})
