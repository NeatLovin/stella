/** Active le service worker (site publié uniquement) pour permettre l'ouverture hors-ligne. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', async () => {
    try {
      const base = import.meta.env.BASE_URL
      await navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
      const reg = await navigator.serviceWorker.ready

      // Envoie au service worker les fichiers déjà chargés (y compris ceux préchargés ensuite)
      const send = () => {
        const urls = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin) && !u.includes('/sw.js'))
        reg.active?.postMessage({ type: 'cache-urls', urls })
      }
      send()
      window.setTimeout(send, 6000)
    } catch {
      /* sans service worker, le site fonctionne normalement (en ligne) */
    }
  })
}
