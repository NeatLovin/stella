import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDialog } from '../hooks/useDialog'
import { createPortal } from 'react-dom'
import { SPRING_SOFT } from '../lib/motion'

const wideQuery = '(min-width: 768px)'
const useWide = () => {
  const [wide, setWide] = useState(() => window.matchMedia(wideQuery).matches)
  useEffect(() => {
    const m = window.matchMedia(wideQuery)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

interface Props {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}

/** Panneau qui monte du bas (mobile) ou s'ouvre au centre (desktop). */
export function BottomSheet({ open, onClose, label, children }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  useDialog(open, panel, onClose)
  const wide = useWide()
  const drag = useDragControls()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal aria-label={label}>
          <motion.button
            type="button"
            aria-label="Fermer"
            tabIndex={-1}
            className="absolute inset-0 bg-night/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            tabIndex={-1}
            className="relative max-h-[88dvh] outline-none w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] border border-glow/20 bg-sky/95 px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-10px_60px_rgb(46_91_255/0.25)] md:rounded-[1.75rem] md:pt-6"
            // Téléphone : monte du bas et se ferme en le glissant vers le bas par la poignée.
            // Ordinateur : s'ouvre au centre en grandissant légèrement.
            initial={wide ? { opacity: 0, scale: 0.94, y: 16 } : { y: '100%' }}
            animate={wide ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={wide ? { opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.18 } } : { y: '100%' }}
            transition={wide ? SPRING_SOFT : { type: 'spring', damping: 30, stiffness: 320 }}
            drag={wide ? false : 'y'}
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose()
            }}
          >
            <div
              className="-mx-6 -mt-3 mb-1 flex cursor-grab touch-none justify-center pt-3 pb-3 active:cursor-grabbing md:hidden"
              onPointerDown={(e) => drag.start(e)}
              aria-hidden
            >
              <span className="h-1.5 w-10 rounded-full bg-mist/30" />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
