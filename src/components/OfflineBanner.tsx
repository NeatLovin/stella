import { AnimatePresence, motion } from 'motion/react'
import { useSyncExternalStore } from 'react'

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/** Petit bandeau en haut quand l'appareil n'a plus de réseau. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          className="glass fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[45] mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full px-4 py-2 text-center text-sm text-starlight"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
        >
          Hors ligne : tu vois la dernière version enregistrée.
        </motion.div>
      )}
    </AnimatePresence>
  )
}
