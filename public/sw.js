/* Stella : service worker pour l'ouverture hors-ligne.
 * - Application (HTML, JS, CSS, polices, icônes) : gardée sur l'appareil, rechargée quand il y a du réseau.
 * - Photos privées (Supabase Storage) : gardées par chemin, quel que soit le jeton du lien signé.
 * - Données (Supabase REST / Auth) : jamais interceptées ici (gérées par l'application).
 */
const APP_CACHE = 'stella-app-v1'
const PHOTO_CACHE = 'stella-photos-v2' // v2 : vide les erreurs gardées par erreur en v1
const KEEP = [APP_CACHE, PHOTO_CACHE]

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.add(self.registration.scope)).catch(() => {}))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (!KEEP.includes(name)) await caches.delete(name)
      await self.clients.claim()
    })(),
  )
})

// La page envoie la liste des fichiers déjà chargés pour qu'ils soient disponibles hors-ligne
self.addEventListener('message', (event) => {
  const urls = event.data && event.data.type === 'cache-urls' ? event.data.urls : null
  if (!Array.isArray(urls)) return
  event.waitUntil(
    caches.open(APP_CACHE).then((c) =>
      Promise.all(urls.map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => {})))),
    ),
  )
})

const isPhoto = (url) => url.pathname.includes('/storage/v1/object/')
const photoKey = (url) => url.origin + url.pathname

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Photos : cache d'abord (les fichiers ne changent jamais pour un même chemin).
  // Demandées en CORS pour pouvoir lire le statut : seules les vraies photos (200) sont gardées,
  // jamais une erreur de lien expiré.
  if (isPhoto(url)) {
    event.respondWith(
      caches.open(PHOTO_CACHE).then(async (c) => {
        const hit = await c.match(photoKey(url))
        if (hit) return hit
        const res = await fetch(req.url, { mode: 'cors', credentials: 'omit' })
        const type = res.headers.get('content-type') || ''
        if (res.ok && type.startsWith('image/')) c.put(photoKey(url), res.clone()).catch(() => {})
        return res
      }),
    )
    return
  }

  if (url.origin !== self.location.origin) return

  // Pages : réseau d'abord (dernière version du site), sinon la version gardée
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(APP_CACHE).then((c) => c.put(self.registration.scope, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(self.registration.scope)),
    )
    return
  }

  // Fichiers de l'application : version gardée tout de suite, mise à jour en arrière-plan
  event.respondWith(
    caches.open(APP_CACHE).then(async (c) => {
      const hit = await c.match(req)
      const network = fetch(req)
        .then((res) => {
          if (res.ok) c.put(req, res.clone()).catch(() => {})
          return res
        })
        .catch(() => hit)
      return hit || network
    }),
  )
})
