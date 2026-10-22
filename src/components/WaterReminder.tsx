import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { todayISO } from '../lib/dates'

// Pop-up « pub » qui rappelle de boire de l'eau.
// Apparaît quelques secondes après l'arrivée sur le site, puis au plus toutes les 2 h.
// L'état est propre à chaque téléphone (localStorage), c'est voulu.

const FIRST_DELAY = 5_000
const AFTER_DRINK = 2 * 60 * 60 * 1000
const AFTER_SNOOZE = 30 * 60 * 1000
const KEY_NEXT = 'stella.water.next'
const KEY_COUNT = 'stella.water.count'

const MESSAGES = [
  'Petite pause : un grand verre d’eau, pour moi ?',
  'Ton corps te dit merci d’avance. Un verre d’eau ?',
  'Une étoile, ça brille mieux bien hydratée. Va boire un verre.',
  'Rappel officiel : tu es précieuse, et l’eau aussi.',
  'Le service client s’inquiète : as-tu bu de l’eau récemment ?',
]

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* stockage indisponible : on oublie simplement */
  }
}

function todayCount(): number {
  const [day, n] = (read(KEY_COUNT) ?? '').split('|')
  return day === todayISO() ? Number(n) || 0 : 0
}

export function WaterReminder({ sponsor }: { sponsor: string }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState(MESSAGES[0])
  const [count, setCount] = useState(todayCount)

  useEffect(() => {
    const check = () => {
      if (document.hidden) return
      const next = Number(read(KEY_NEXT) ?? 0)
      if (Date.now() >= next) {
        setMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)])
        setCount(todayCount())
        setOpen(true)
      }
    }
    const first = setTimeout(check, FIRST_DELAY)
    const every = setInterval(check, 60_000)
    return () => {
      clearTimeout(first)
      clearInterval(every)
    }
  }, [])

  const close = (delay: number) => {
    write(KEY_NEXT, String(Date.now() + delay))
    setOpen(false)
  }

  const drank = () => {
    const n = todayCount() + 1
    write(KEY_COUNT, `${todayISO()}|${n}`)
    setCount(n)
    close(AFTER_DRINK)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" role="dialog" aria-modal aria-label="Rappel : boire de l’eau">
          <motion.button
            type="button"
            aria-label="Plus tard"
            className="absolute inset-0 bg-night/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close(AFTER_SNOOZE)}
          />
          <motion.div
            className="relative w-full max-w-xs overflow-hidden rounded-[1.5rem] border border-glow/30 bg-sky text-center shadow-[0_0_60px_rgb(46_91_255/0.4)]"
            initial={{ scale: 0.6, opacity: 0, rotate: -4 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 14, stiffness: 220 }}
          >
            <button
              type="button"
              onClick={() => close(AFTER_SNOOZE)}
              className="absolute top-0 right-1 px-3 py-1 text-lg leading-none text-glow/80"
              aria-label="Fermer"
            >
              ×
            </button>
            <p className="bg-electric/20 px-4 py-1.5 text-[0.7rem] text-glow">Annonce sponsorisée par {sponsor || 'quelqu’un qui t’aime'}</p>
            <div className="px-6 pt-5 pb-6">
              <Glass />
              <p className="font-display mt-4 text-[1.6rem] leading-tight">{message}</p>
              {count > 0 && (
                <p className="mt-2 text-sm text-mist">
                  Déjà {count} verre{count > 1 ? 's' : ''} aujourd’hui
                </p>
              )}
              <button type="button" className="btn-primary mt-5 w-full" onClick={drank}>
                C’est fait 💧
              </button>
              <button type="button" className="mt-3 text-sm text-mist" onClick={() => close(AFTER_SNOOZE)}>
                Dans 30 minutes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Glass() {
  return (
    <svg viewBox="0 0 80 96" className="mx-auto h-20" aria-hidden>
      <defs>
        <clipPath id="glass">
          <path d="M14 10h52l-6 76a6 6 0 0 1-6 5H26a6 6 0 0 1-6-5Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#glass)">
        <motion.path
          d="M0 44 Q20 38 40 44 T80 44 T120 44 V100 H0Z"
          fill="#2E5BFF"
          opacity="0.75"
          animate={{ x: [0, -40] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
        />
        <circle cx="32" cy="70" r="2" fill="#F4F6FF" opacity="0.6" />
        <circle cx="46" cy="60" r="1.5" fill="#F4F6FF" opacity="0.5" />
      </g>
      <path d="M14 10h52l-6 76a6 6 0 0 1-6 5H26a6 6 0 0 1-6-5Z" fill="none" stroke="#7DA2FF" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}
