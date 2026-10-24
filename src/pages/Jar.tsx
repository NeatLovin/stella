import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { IconHeart } from '../components/icons'
import { ErrorNote, Page, Skeleton } from '../components/Page'
import { useLoad } from '../hooks/useLoad'
import { api, type Reason } from '../lib/api'
import { drawFromBag, emptyBag, markSeen, uniqueByText, type BagState } from '../lib/bag'
import { diffDays, todayISO } from '../lib/dates'

// Tirages déjà faits sur cet appareil, conservés entre les visites
const BAG_KEY = 'stella.jar.seen'
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const readBag = (): BagState => {
  try {
    const v = JSON.parse(localStorage.getItem(BAG_KEY) ?? 'null')
    if (Array.isArray(v)) return { seen: strings(v), cooldown: [] } // ancien format
    if (v && typeof v === 'object') return { seen: strings(v.seen), cooldown: strings(v.cooldown) }
  } catch {
    /* illisible : on repart de zéro */
  }
  return emptyBag()
}
const writeBag = (state: BagState) => {
  try {
    localStorage.setItem(BAG_KEY, JSON.stringify(state))
  } catch {
    /* stockage indisponible : le sac repart de zéro à la prochaine visite */
  }
}

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
  const { data, error, loading, reload } = useLoad(api.getReasons, 'reasons')

  return (
    <Page wide title="Le bocal" intro="Une raison par jour. Et d’autres, quand tu en as besoin.">
      {loading && <Skeleton variant="jar" />}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {data && data.length === 0 && <p className="text-mist">Le bocal attend ses premières raisons.</p>}
      {data && data.length > 0 && <JarContent reasons={uniqueByText(data)} />}
    </Page>
  )
}

function JarContent({ reasons }: { reasons: Reason[] }) {
  const today = useMemo(() => reasonOfTheDay(reasons), [reasons])
  const ids = useMemo(() => reasons.map((r) => r.id), [reasons])
  const [current, setCurrent] = useState<Reason>(today)
  // Favoris : mis à jour tout de suite à l'écran, puis enregistrés
  const [fav, setFav] = useState<Record<string, boolean>>({})
  const [favError, setFavError] = useState<string | null>(null)
  const [showFavs, setShowFavs] = useState(false)
  const isFav = (r: Reason) => fav[r.id] ?? r.favorite
  const favorites = reasons.filter(isFav)

  const toggleFav = async (r: Reason) => {
    const next = !isFav(r)
    setFav((f) => ({ ...f, [r.id]: next }))
    setFavError(null)
    try {
      await api.setReasonFavorite(r.id, next)
    } catch (e) {
      setFav((f) => ({ ...f, [r.id]: !next }))
      setFavError(e instanceof Error ? e.message : String(e))
    }
  }

  // La raison du jour compte comme déjà lue
  useEffect(() => {
    writeBag(markSeen(ids, readBag(), today.id))
  }, [ids, today.id])

  const draw = () => {
    if (reasons.length < 2) return
    const { id, state } = drawFromBag(ids, readBag())
    writeBag(state)
    setCurrent(reasons.find((r) => r.id === id)!)
  }

  const isToday = current.id === today.id

  return (
    <div className="flex flex-col items-center lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-16 xl:gap-24">
      <div className="min-h-48 w-full [perspective:900px] lg:flex lg:min-h-[20rem] lg:items-center">
        <AnimatePresence mode="wait">
          <motion.figure
            key={current.id + (isToday ? '-today' : '')}
            className="relative w-full origin-top rounded-[1.25rem] border border-glow/20 bg-starlight/[0.04] px-5 py-6 lg:mx-auto lg:max-w-[36rem] lg:rounded-[1.5rem] lg:px-9 lg:py-8 shadow-[0_0_50px_rgb(46_91_255/0.15)] backdrop-blur-sm"
            initial={{ rotateX: -80, opacity: 0, y: -10 }}
            animate={{ rotateX: 0, opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', damping: 18, stiffness: 140 }}
          >
            <figcaption className="font-display pr-10 text-lg text-glow italic lg:text-xl">
              {isToday ? 'La raison du jour' : 'Une autre raison'}
            </figcaption>
            <FavButton active={isFav(current)} onToggle={() => void toggleFav(current)} />
            <blockquote className="font-display mt-3 text-[1.55rem] leading-snug lg:mt-4 lg:text-[clamp(1.75rem,1.9vw,2.1rem)] lg:leading-[1.25]">
              {current.text}
            </blockquote>
          </motion.figure>
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={draw}
        disabled={reasons.length < 2}
        className="group mt-8 flex flex-col items-center disabled:opacity-60 lg:mt-0"
        aria-label="Tirer une autre raison"
      >
        <JarArt count={reasons.length} />
        <span className="btn-ghost mt-5">Tirer une autre raison</span>
      </button>

      <div className="mt-6 flex flex-col items-center lg:col-start-2 lg:mt-0">
        <button
          type="button"
          className="inline-flex items-center gap-2 py-2 text-sm text-mist hover:text-starlight"
          onClick={() => setShowFavs(true)}
        >
          <IconHeart width={16} height={16} filled={favorites.length > 0} className="text-rose" />
          Mes préférées{favorites.length > 0 ? ` (${favorites.length})` : ''}
        </button>
        {favError && (
          <p role="alert" className="mt-1 text-center text-sm text-rose">
            Impossible d’enregistrer le favori : {favError}
          </p>
        )}
      </div>

      <BottomSheet open={showFavs} onClose={() => setShowFavs(false)} label="Mes raisons préférées">
        <h2 className="font-display text-3xl font-medium">Mes préférées</h2>
        {favorites.length === 0 ? (
          <p className="mt-3 text-mist">Touche le cœur d’une raison pour la garder ici et la relire quand tu veux.</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {favorites.map((r) => (
              <li key={r.id} className="relative rounded-[1rem] border border-glow/15 bg-starlight/[0.04] py-4 pr-14 pl-5">
                <p className="font-display text-[1.25rem] leading-snug">{r.text}</p>
                <FavButton active onToggle={() => void toggleFav(r)} />
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </div>
  )
}

function FavButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? 'Retirer des préférées' : 'Ajouter aux préférées'}
      className={`absolute top-2 right-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
        active ? 'text-rose' : 'text-mist/70 hover:text-rose'
      }`}
    >
      <motion.span
        key={String(active)}
        initial={{ scale: active ? 0.4 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 9, stiffness: 320 }}
      >
        <IconHeart width={22} height={22} filled={active} className={active ? 'drop-shadow-[0_0_8px_rgb(255_107_154/0.7)]' : ''} />
      </motion.span>
    </button>
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
    <svg viewBox="0 0 160 230" className="h-48 w-auto lg:h-80 transition-transform duration-300 group-active:-rotate-6" aria-hidden>
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
