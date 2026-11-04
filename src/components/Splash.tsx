import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'

// Écran de chargement : l'étoile se dessine, s'allume, puis « Stella » apparaît lettre par lettre.
// À la sortie, l'étoile s'envole en grandissant pendant que l'écran se dissout.

const STAR = 'M32 8 C34 24 40 30 56 32 C40 34 34 40 32 56 C30 40 24 34 8 32 C24 30 30 24 32 8 Z'
const WORD = 'Stella'

// Petites étoiles du fond, toujours aux mêmes places
const DOTS = Array.from({ length: 22 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  return { x: r(1) * 100, y: r(2) * 100, s: 1 + r(3) * 2, d: r(4) * 2, t: 1.6 + r(5) * 2.2 }
})

export function Splash() {
  const reduced = useReducedMotion()

  // Le rappel d'eau et le ciel animé attendent la fin de l'écran
  useEffect(() => {
    document.body.dataset.playing = '1'
    return () => {
      delete document.body.dataset.playing
    }
  }, [])

  return (
    <motion.div
      role="status"
      aria-label="Chargement de Stella"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-night"
      style={{ backgroundImage: 'radial-gradient(70% 45% at 50% 46%, rgb(46 91 255 / 0.22), transparent 70%)' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0.2 : 0.7, delay: reduced ? 0 : 0.15, ease: 'easeInOut' } }}
    >
      {!reduced &&
        DOTS.map((d, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute rounded-full bg-starlight"
            style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0.15, 0.8] }}
            transition={{ delay: 0.2 + d.d * 0.5, duration: d.t, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          />
        ))}

      <motion.div
        aria-hidden
        className="relative h-28 w-28"
        initial={reduced ? { opacity: 0 } : { rotate: -45, scale: 0.7 }}
        animate={reduced ? { opacity: 1 } : { rotate: 0, scale: 1 }}
        transition={reduced ? { duration: 0.3 } : { type: 'spring', damping: 14, stiffness: 60, delay: 0.1 }}
        exit={
          reduced ? { opacity: 0 } : { scale: 2.4, opacity: 0, filter: 'blur(6px)', transition: { duration: 0.75, ease: [0.4, 0, 0.2, 1] } }
        }
      >
        {/* Halo qui respire */}
        <motion.span
          className="absolute inset-[-55%] rounded-full"
          style={{ background: 'radial-gradient(circle, rgb(46 91 255 / 0.55), rgb(46 91 255 / 0) 62%)' }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={reduced ? { opacity: 0.8, scale: 1 } : { opacity: [0, 1, 0.7, 1], scale: [0.6, 1, 0.94, 1] }}
          transition={
            reduced ? { duration: 0.3 } : { delay: 0.75, duration: 2.4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
          }
        />
        <svg viewBox="0 0 64 64" className="relative h-full w-full overflow-visible">
          <motion.path
            d={STAR}
            stroke="#7DA2FF"
            strokeWidth={1.2}
            strokeLinejoin="round"
            fill="#7DA2FF"
            initial={reduced ? { pathLength: 1, fillOpacity: 1 } : { pathLength: 0, fillOpacity: 0 }}
            animate={{ pathLength: 1, fillOpacity: 1 }}
            transition={{
              pathLength: { duration: 0.9, ease: 'easeInOut' },
              fillOpacity: { delay: 0.7, duration: 0.5, ease: 'easeOut' },
            }}
            style={{ filter: 'drop-shadow(0 0 6px rgb(125 162 255 / 0.8))' }}
          />
          <motion.circle
            cx="32"
            cy="32"
            r="4"
            fill="#F4F6FF"
            initial={{ scale: reduced ? 1 : 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: reduced ? 0 : 1, type: 'spring', damping: 8, stiffness: 260 }}
            style={{ transformOrigin: '32px 32px', filter: 'drop-shadow(0 0 4px #F4F6FF)' }}
          />
        </svg>
      </motion.div>

      <motion.p
        className="font-display mt-10 text-[2.6rem] leading-none tracking-[0.18em] italic"
        exit={reduced ? undefined : { opacity: 0, y: -6, filter: 'blur(4px)', transition: { duration: 0.45 } }}
      >
        {WORD.split('').map((ch, i) => (
          <motion.span
            key={i}
            className="inline-block"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: reduced ? 0.1 : 0.85 + i * 0.07, duration: reduced ? 0.3 : 0.6, ease: 'easeOut' }}
          >
            {ch}
          </motion.span>
        ))}
      </motion.p>
    </motion.div>
  )
}
