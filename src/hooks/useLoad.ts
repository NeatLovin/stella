import { useCallback, useEffect, useRef, useState } from 'react'
import { readCache, writeCache } from '../lib/offline'

/**
 * Charge des données asynchrones avec état de chargement, erreur et rechargement.
 * Avec `cacheKey` : affiche tout de suite la dernière version gardée sur l'appareil,
 * puis la remplace par les données fraîches. Sans réseau, la copie locale reste affichée (`stale`).
 */
export function useLoad<T>(fn: () => Promise<T>, cacheKey?: string) {
  const cached = useRef(cacheKey ? readCache<T>(cacheKey) : null)
  const [data, setData] = useState<T | null>(cached.current)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(cached.current === null)
  const [stale, setStale] = useState(false)
  const hasData = useRef(cached.current !== null)

  const reload = useCallback(async () => {
    try {
      setError(null)
      const fresh = await fn()
      setData(fresh)
      hasData.current = true
      setStale(false)
      if (cacheKey) writeCache(cacheKey, fresh)
    } catch (e) {
      // Une copie est déjà affichée : on la garde plutôt que de montrer une erreur
      if (hasData.current) setStale(true)
      else setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
    // fn est stable (fonction de l'api)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, loading, stale, reload, setData }
}
