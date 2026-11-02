import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDialog } from '../hooks/useDialog'
import { api } from '../lib/api'
import { formatLong } from '../lib/dates'
import { defaultMessage, type Milestone } from '../lib/milestones'

const SEEN_KEY = 'stella.milestone.seen'

/** Déjà fêté sur cet appareil ? (une seule ouverture automatique par jalon) */
export function milestoneSeen(m: Milestone): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === m.key
  } catch {
    return false
  }
}
function markSeen(m: Milestone) {
  try {
    localStorage.setItem(SEEN_KEY, m.key)
  } catch {
    /* rien à retenir */
  }
}

/** Écran de fête d'un jalon : pluie d'étoiles, grand chiffre et le mot écrit pour l'occasion. */
export function MilestoneCelebration({ milestone, open, onClose }: { milestone: Milestone; open: boolean; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const close = () => {
    markSeen(milestone)
    onClose()
  }
  useDialog(open, root, close)

  useEffect(() => {
    if (!open) return
    document.body.dataset.playing = '1'
    return () => {
      delete document.body.dataset.playing
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={root}
          tabIndex={-1}
          role="dialog"
          aria-modal
          aria-label={`${milestone.n} ${milestone.label}`}
          className="fixed inset-0 z-[66] overflow-y-auto bg-night/92 outline-none backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <StarShower />
          <Content milestone={milestone} onClose={close} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Content({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .getMilestoneMessage(milestone.key)
      .then((m) => alive && setMessage(m?.trim() || defaultMessage(milestone)))
      .catch(() => alive && setMessage(defaultMessage(milestone)))
    return () => {
      alive = false
    }
  }, [milestone])

  const paragraphs = (message ?? '').split(/\n\s*\n/).filter(Boolean)

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
      <motion.p
        className="text-sm tracking-[0.25em] text-gold uppercase"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        Aujourd’hui
      </motion.p>
      <motion.p
        className="font-display glow-text mt-2 text-[clamp(6rem,32vw,11rem)] leading-none font-medium tabular-nums lining-nums"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.45, type: 'spring', damping: 12, stiffness: 120 }}
      >
        {milestone.n}
      </motion.p>
      <motion.h2
        className="font-display mt-1 text-[clamp(1.8rem,7vw,2.6rem)] text-glow italic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {milestone.label}
      </motion.h2>
      <motion.p className="mt-2 text-sm text-mist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
        {formatLong(milestone.date)}
      </motion.p>

      <motion.div
        className="glass mt-8 w-full max-w-[32rem] rounded-3xl px-6 py-6 text-left lg:px-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: message ? 1 : 0, y: message ? 0 : 16 }}
        transition={{ delay: 1.3, duration: 0.7 }}
      >
        <div className="font-display space-y-3 text-[1.3rem] leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </motion.div>

      <motion.button
        type="button"
        onClick={onClose}
        className="btn-primary mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
      >
        Continuer
      </motion.button>
    </div>
  )
}

/** Gerbe d'étoiles qui éclate au centre puis retombe doucement (rien si les animations sont réduites). */
function StarShower() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      cv.width = innerWidth * dpr
      cv.height = innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const colors = ['#2e5bff', '#7da2ff', '#f4f6ff', '#ffd98a', '#a9c2ff']
    type P = { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; c: string; life: number; max: number }
    const parts: P[] = []
    const add = (x: number, y: number, speed: number) => {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.35 + Math.random() * 0.65)
      const max = 3 + Math.random() * 3
      parts.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.35,
        r: 2.5 + Math.random() * 5,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 4,
        c: colors[Math.floor(Math.random() * colors.length)],
        life: max,
        max,
      })
    }
    // Éclat central, puis quelques étoiles qui tombent du haut pendant un moment
    for (let i = 0; i < 160; i++) add(innerWidth / 2, innerHeight * 0.32, 520)
    let rain = 4

    const star = (p: P) => {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = Math.min(1, p.life / 1.2)
      ctx.fillStyle = p.c
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const rr = i % 2 ? p.r * 0.32 : p.r
        const a = (i * Math.PI) / 4
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    let raf = 0
    let last = 0
    const loop = (t: number) => {
      const dt = Math.min(0.033, last ? (t - last) / 1000 : 0)
      last = t
      if (rain > 0) {
        rain -= dt
        if (Math.random() < 0.6) {
          parts.push({
            x: Math.random() * innerWidth,
            y: -10,
            vx: (Math.random() - 0.5) * 30,
            vy: 40 + Math.random() * 60,
            r: 2 + Math.random() * 4,
            rot: 0,
            vr: (Math.random() - 0.5) * 2,
            c: colors[Math.floor(Math.random() * colors.length)],
            life: 6,
            max: 6,
          })
        }
      }
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      for (const p of parts) {
        p.vy += 160 * dt
        p.vx *= 0.985
        p.vy = Math.min(p.vy, 170)
        p.x += p.vx * dt + Math.sin(t / 400 + p.rot) * 0.3
        p.y += p.vy * dt
        p.rot += p.vr * dt
        p.life -= dt
        star(p)
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0 || parts[i].y > innerHeight + 20) parts.splice(i, 1)
      if (parts.length || rain > 0) raf = requestAnimationFrame(loop)
      else ctx.clearRect(0, 0, innerWidth, innerHeight)
    }
    raf = requestAnimationFrame(loop)
    addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 h-full w-full" />
}
