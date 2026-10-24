// Mémoire locale des données, pour un affichage instantané et le mode hors-ligne.
// Rien ne sort de l'appareil : ce sont des copies des dernières données reçues.

const PREFIX = 'stella.cache.'

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* stockage plein ou indisponible : pas de copie locale, sans conséquence */
  }
}

/** Efface toutes les copies locales (déconnexion). */
export function clearCache() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k)
  } catch {
    /* rien à faire */
  }
}

// L'appareil s'est déjà connecté : il peut rouvrir le site hors-ligne avec les données en mémoire.
const TRUSTED = 'stella.offline.trusted'
export const markTrusted = () => {
  try {
    localStorage.setItem(TRUSTED, '1')
  } catch {
    /* rien */
  }
}
export const forgetTrusted = () => {
  try {
    localStorage.removeItem(TRUSTED)
  } catch {
    /* rien */
  }
  clearCache()
}
export const isTrusted = () => {
  try {
    return localStorage.getItem(TRUSTED) === '1'
  } catch {
    return false
  }
}
