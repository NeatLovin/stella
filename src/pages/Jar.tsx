import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { ErrorNote, Loading, Page } from '../components/Page'
import { useLoad } from '../hooks/useLoad'
import { api, type Reason } from '../lib/api'
import { diffDays, todayISO } from '../lib/dates'

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Raison du jour : ordre mélangé une fois pour toutes, puis une par jour. */
function reasonOfTheDay(reasons: Reason[]): Reason {
  const order = [...reasons]
  const rand = rng(46)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const day = diffDays(todayISO(), '2026-01-01')
  return order[((day % order.length) + order.length) % order.length]
}

export function Jar() {
  const { data, error, loading, reload } = useLoad(api.getReasons)

  return (
    <Page title="Le bocal" intro="Une raison par jour. Et d’autres, quand tu en as besoin.">
      {loading && <Loading />}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {data && data.length === 0 && <p className="text-mist">Le bocal attend ses premières raisons.</p>}
      {data && data.length > 0 && <JarContent reasons={data} />}
    </Page>
  )
}

function JarContent({ reasons }: { reasons: Reason[] }) {
  const today = useMemo(() => reasonOfTheDay(reasons), [reasons])
  const [current, setCurrent] = useState<Reason>(today)
  const recent = useRef<string[]>([today.id])

  const draw = () => {
    if (reasons.length < 2) return
    const avoid = recent.current.slice(-Math.min(5, reasons.length - 1))
    const pool = reasons.filter((r) => !avoid.includes(r.id))
    const next = pool[Math.floor(Math.random() * pool.length)]
    recent.current = [...recent.current, next.id]
    setCurrent(next)
  }

  const isToday = current.id === today.id

  return (
    <div className="flex flex-col items-center">
      <div className="min-h-56 w-full [perspective:900px]">
        <AnimatePresence mode="wait">
          <motion.figure
            key={current.id + (isToday ? '-today' : '')}
            className="origin-top rounded-[1.25rem] border border-glow/20 bg-starlight/[0.04] px-6 py-7 shadow-[0_0_50px_rgb(46_91_255/0.15)] backdrop-blur-sm"
            initial={{ rotateX: -80, opacity: 0, y: -10 }}
            animate={{ rotateX: 0, opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', damping: 18, stiffness: 140 }}
          >
            <figcaption className="font-display text-lg text-glow italic">{isToday ? 'La raison du jour' : 'Une autre raison'}</figcaption>
            <blockquote className="font-display mt-3 text-[1.75rem] leading-snug">{current.text}</blockquote>
          </motion.figure>
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={draw}
        disabled={reasons.length < 2}
        className="group mt-8 flex flex-col items-center disabled:opacity-60"
        aria-label="Tirer une autre raison"
      >
        <JarArt count={reasons.length} />
        <span className="btn-ghost mt-5">Tirer une autre raison</span>
      </button>
    </div>
  )
}

function JarArt({ count }: { count: number }) {
  const papers = useMemo(() => {
    const rand = rng(7)
    const n = Math.min(count, 60)
    return Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / 6)
      return {
        x: 38 + (i % 6) * 15 + (rand() - 0.5) * 8,
        y: 196 - row * 12 + (rand() - 0.5) * 6,
        r: (rand() - 0.5) * 70,
        c: ['#F4F6FF', '#7DA2FF', '#FFD98A', '#C9D6FF'][Math.floor(rand() * 4)],
      }
    })
  }, [count])

  return (
    <svg viewBox="0 0 160 230" className="h-48 w-auto transition-transform duration-300 group-active:-rotate-6" aria-hidden>
      <defs>
        <clipPath id="jar-body">
          <path d="M40 58c-14 8-22 22-22 40v100c0 10 8 18 18 18h88c10 0 18-8 18-18V98c0-18-8-32-22-40Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#jar-body)">
        {papers.map((p, i) => (
          <rect
            key={i}
            x={p.x - 6}
            y={p.y - 4}
            width="12"
            height="8"
            rx="1.5"
            fill={p.c}
            opacity="0.85"
            transform={`rotate(${p.r} ${p.x} ${p.y})`}
          />
        ))}
      </g>
      <path
        d="M40 58c-14 8-22 22-22 40v100c0 10 8 18 18 18h88c10 0 18-8 18-18V98c0-18-8-32-22-40"
        fill="rgb(125 162 255 / 0.08)"
        stroke="#7DA2FF"
        strokeOpacity="0.7"
        strokeWidth="2"
      />
      <rect x="44" y="30" width="72" height="28" rx="6" fill="#18225A" stroke="#7DA2FF" strokeOpacity="0.7" strokeWidth="2" />
      <path d="M36 100c0-12 4-20 12-26" stroke="#F4F6FF" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}
