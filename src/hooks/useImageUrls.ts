import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { readCache, writeCache } from '../lib/offline'

// Les liens signés vers les photos expirent après 6 h (voir api.imageUrls).
// On les renouvelle avant expiration, et au retour sur l'onglet (téléphone mis en veille).
const STALE_AFTER = 5 * 60 * 60 * 1000
const CHECK_EVERY = 10 * 60 * 1000

/** Liens d'affichage des photos privées, renouvelés automatiquement. */
export function useImageUrls(paths: (string | null | undefined)[]): Record<string, string> {
  // Derniers liens connus : hors-ligne, le service worker retrouve la photo par son chemin
  const [urls, setUrls] = useState<Record<string, string>>(() => readCache<Record<string, string>>('imageUrls') ?? {})
  const fetchedAt = useRef<Record<string, number>>({})
  const list = [...new Set(paths.filter((p): p is string => Boolean(p)))].sort()
  const key = list.join('|')

  useEffect(() => {
    let cancelled = false
    const wanted = key ? key.split('|') : []

    const refresh = async () => {
      const now = Date.now()
      const stale = wanted.filter((p) => !fetchedAt.current[p] || now - fetchedAt.current[p] > STALE_AFTER)
      if (!stale.length) return
      try {
        const fresh = await api.imageUrls(stale)
        if (cancelled) return
        for (const p of stale) fetchedAt.current[p] = now
        setUrls((prev) => {
          const next = { ...prev, ...fresh }
          writeCache('imageUrls', next)
          return next
        })
      } catch {
        /* réseau indisponible : nouvel essai au prochain contrôle */
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), CHECK_EVERY)
    const onVisible = () => !document.hidden && void refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [key])

  return urls
}
