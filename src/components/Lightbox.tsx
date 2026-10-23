import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useDialog } from '../hooks/useDialog'
import { createPortal } from 'react-dom'
import { IconChevron } from './icons'

export interface LightboxImage {
  src?: string
  alt: string
}

interface Props {
  images: LightboxImage[]
  /** Photo ouverte, ou null quand le plein écran est fermé */
  index: number | null
  onIndexChange?: (index: number) => void
  onClose: () => void
}

const SWIPE_DISTANCE = 60
const SWIPE_SPEED = 400

/**
 * Photos en plein écran, dans leur format d'origine (aucun recadrage).
 * Swipe gauche / droite pour passer d'une photo à l'autre, swipe vers le bas ou × pour fermer.
 */
export function Lightbox({ images, index, onIndexChange, onClose }: Props) {
  const [direction, setDirection] = useState(0)
  const open = index !== null && Boolean(images[index])
  const count = images.length
  const canPrev = open && index! > 0
  const canNext = open && index! < count - 1

  const go = (delta: number) => {
    if (index === null) return
    const next = index + delta
    if (next < 0 || next >= count) return
    setDirection(delta)
    onIndexChange?.(next)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info
    if (Math.abs(offset.y) > Math.abs(offset.x)) {
      if (offset.y > 120 || velocity.y > 600) onClose()
      return
    }
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_SPEED) go(1)
    else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_SPEED) go(-1)
  }

  const image = open ? images[index!] : null
  const root = useRef<HTMLDivElement>(null)
  useDialog(open, root, onClose)

  return createPortal(
    <AnimatePresence>
      {open && image && (
        <motion.div
          ref={root}
          tabIndex={-1}
          className="fixed inset-0 z-[70] outline-none touch-none overflow-hidden bg-black select-none"
          role="dialog"
          aria-modal
          aria-label={image.alt || 'Photo en plein écran'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={index}
              custom={direction}
              className="absolute inset-0 flex items-center justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
              variants={{
                enter: (d: number) => ({ x: d > 0 ? '100%' : d < 0 ? '-100%' : 0, opacity: d === 0 ? 0 : 1, scale: d === 0 ? 0.94 : 1 }),
                center: { x: 0, opacity: 1, scale: 1 },
                exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 1 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={{ left: canNext ? 0.7 : 0.15, right: canPrev ? 0.7 : 0.15, top: 0.1, bottom: 0.6 }}
              onDragEnd={onDragEnd}
            >
              {image.src ? (
                <img src={image.src} alt={image.alt} draggable={false} className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="h-2 w-2 animate-ping rounded-full bg-glow" role="status" aria-label="Chargement" />
              )}
            </motion.div>
          </AnimatePresence>

          {count > 1 && (
            <>
              <p className="absolute top-[max(1.1rem,env(safe-area-inset-top))] left-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white tabular-nums backdrop-blur">
                {index! + 1} / {count}
              </p>
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={!canPrev}
                aria-label="Photo précédente"
                className="absolute top-1/2 left-2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur disabled:opacity-0 md:flex"
              >
                <IconChevron dir="left" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={!canNext}
                aria-label="Photo suivante"
                className="absolute top-1/2 right-2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur disabled:opacity-0 md:flex"
              >
                <IconChevron />
              </button>
            </>
          )}

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
