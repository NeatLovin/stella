import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  src: string | null
  alt?: string
  onClose: () => void
}

/** Photo en plein écran, dans son format d'origine (aucun recadrage). Un tap ou Échap ferme. */
export function Lightbox({ src, alt = '', onClose }: Props) {
  useEffect(() => {
    if (!src) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, onClose])

  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black"
          role="dialog"
          aria-modal
          aria-label={alt || 'Photo en plein écran'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.img
            src={src}
            alt={alt}
            className="max-h-dvh max-w-full object-contain p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]"
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white backdrop-blur"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
