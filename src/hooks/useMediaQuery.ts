import { useSyncExternalStore } from 'react'

/** Suit une media query CSS (ex. '(min-width: 1024px)') et se met à jour au redimensionnement. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Mise en page « ordinateur » : à partir de 1024 px de large. */
export const DESKTOP = '(min-width: 1024px)'
