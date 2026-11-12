import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { SPRING } from '../lib/motion'

/** Petit bouton ↑ qui apparaît après avoir bien défilé, juste au-dessus de la barre d'onglets. */
export function BackToTop() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let raf = 0
    const check = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setShow(window.scrollY > window.innerHeight * 1.2))
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          aria-label="Revenir en haut"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="press glass fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full text-xl text-starlight shadow-[0_8px_24px_rgb(0_0_0/0.45)] lg:right-8"
          style={{ bottom: 'calc(var(--tabbar-h) + var(--tabbar-gap) + 0.85rem)' }}
          initial={{ opacity: 0, scale: 0.6, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 12 }}
          transition={SPRING}
        >
          <span aria-hidden>↑</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
