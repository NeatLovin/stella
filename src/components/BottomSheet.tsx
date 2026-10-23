import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useDialog } from '../hooks/useDialog'
import { createPortal } from 'react-dom'

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
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-mist/30 md:hidden" aria-hidden />
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
