import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useDialog } from '../hooks/useDialog'
import {
  adventDate,
  adventDayOf,
  adventYear,
  DAYS,
  isUnlocked,
  readOpened,
  setSnow,
  snowEnabled,
  TREE_TOP,
  treeLayout,
  treeLines,
  writeOpened,
  type AdventDay,
  type AdventState,
} from '../lib/advent'
import { api } from '../lib/api'
import { formatLong, todayISO } from '../lib/dates'
import { letterboxdUrl, posterUrl, type Film } from '../lib/films'
import { EASE_OUT, SPRING, SPRING_POP } from '../lib/motion'
import { DenyRun } from './DenyRun'
import { JudeShoot } from './JudeShoot'

// ---------- Carte de l'accueil ----------

/** Carte lumineuse sur l'accueil, tout le mois de décembre. */
export function AdventCard() {
  const today = todayISO()
  const day = adventDayOf(today)
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(readOpened)
  const [snow, setSnowState] = useState(snowEnabled)

  useEffect(() => {
    const sync = () => {
      setOpened(readOpened())
      setSnowState(snowEnabled())
    }
    window.addEventListener('stella:advent', sync)
    window.addEventListener('stella:snow', sync)
    return () => {
      window.removeEventListener('stella:advent', sync)
      window.removeEventListener('stella:snow', sync)
    }
  }, [])

  const year = adventYear(today)
  const count = opened.filter((d) => d.startsWith(`${year}-12-`)).length
  const todayDone = day !== null && opened.includes(adventDate(year, day))
  const subtitle =
    day === null
      ? 'Nos souvenirs de décembre'
      : todayDone
        ? `${count} étoile${count > 1 ? 's' : ''} allumée${count > 1 ? 's' : ''} sur ${DAYS}`
        : `L’étoile n° ${day} t’attend`

  return (
    <>
      <div className="mt-8 flex items-stretch gap-2 self-start">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press glass group relative flex items-center gap-4 overflow-hidden rounded-[1.4rem] py-3 pr-5 pl-3 text-left"
        >
          <span className="relative flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-electric/25 text-2xl">
            <span aria-hidden>🎄</span>
            {day !== null && !todayDone && (
              <motion.span
                aria-hidden
                className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-gold shadow-[0_0_10px_#ffd98a]"
                animate={{ scale: [1, 1.35, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
            )}
          </span>
          <span>
            <span className="font-display block text-xl leading-tight">Calendrier de l’Avent</span>
            <span className={`block text-sm ${day !== null && !todayDone ? 'text-gold' : 'text-mist'}`}>{subtitle}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSnow(!snow)}
          aria-pressed={snow}
          aria-label={snow ? 'Arrêter la neige' : 'Faire tomber la neige'}
          title={snow ? 'Arrêter la neige' : 'Faire tomber la neige'}
          className={`press glass flex w-12 flex-none items-center justify-center rounded-[1.4rem] text-lg ${snow ? 'text-starlight' : 'text-mist/50'}`}
        >
          ❄
        </button>
      </div>
      <AdventCalendar open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** Pastille sur l'onglet « Nous » tant que l'étoile du jour n'est pas ouverte */
export function useAdventBadge(): boolean {
  const [, tick] = useState(0)
  useEffect(() => {
    const sync = () => tick((n) => n + 1)
    window.addEventListener('stella:advent', sync)
    return () => window.removeEventListener('stella:advent', sync)
  }, [])
  const today = todayISO()
  const day = adventDayOf(today)
  if (day === null) return false
  return !readOpened().includes(adventDate(adventYear(today), day))
}

// ---------- Le calendrier ----------

interface Data {
  days: AdventDay[]
  state: AdventState[]
}

export function AdventCalendar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const today = todayISO()
  const year = adventYear(today)
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<AdventDay | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [burst, setBurst] = useState<number | null>(null)
  const [snow, setSnowState] = useState(snowEnabled)
  const [game, setGame] = useState<'deny' | 'jude' | null>(null)
  useDialog(open && !selected && !game, root, onClose)

  useEffect(() => {
    if (!open) return
    let alive = true
    setError(null)
    Promise.all([api.getAdventDays(year), api.getAdventState(year)])
      .then(([days, state]) => {
        if (!alive) return
        setData({ days, state })
        // Le badge suit ce qui est ouvert sur n'importe quel appareil
        writeOpened([...readOpened(), ...state.filter((s) => s.opened_at).map((s) => s.date)])
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Impossible de charger le calendrier'))
    return () => {
      alive = false
    }
  }, [open, year])

  useEffect(() => {
    if (!open) return
    document.body.dataset.playing = '1'
    const html = document.documentElement
    const prev = [html.style.overflow, document.body.style.overflow]
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      delete document.body.dataset.playing
      html.style.overflow = prev[0]
      document.body.style.overflow = prev[1]
    }
  }, [open])

  const stars = useMemo(treeLayout, [])
  const lines = useMemo(() => treeLines(stars), [stars])
  const stateOf = (date: string) => data?.state.find((s) => s.date === date)
  const openedCount = stars.filter((s) => stateOf(adventDate(year, s.day))?.opened_at).length
  const allLit = openedCount === DAYS || today >= adventDate(year, 24)

  const patchState = async (date: string, patch: Partial<Omit<AdventState, 'date'>>) => {
    setData((d) => {
      if (!d) return d
      const cur = d.state.find((s) => s.date === date) ?? { date, opened_at: null, used_at: null, answer: null }
      return { ...d, state: [...d.state.filter((s) => s.date !== date), { ...cur, ...patch }] }
    })
    await api.setAdventState(date, patch)
  }

  const tapStar = (day: number) => {
    const date = adventDate(year, day)
    if (!isUnlocked(date, today)) {
      setHint(`Patience… cette étoile s’allume le ${formatLong(date)} ✦`)
      return
    }
    const content = data?.days.find((d) => d.date === date)
    if (!content) {
      setHint('Cette étoile est encore vide… reviens un peu plus tard ✦')
      return
    }
    setHint(null)
    setBurst(day)
    window.setTimeout(
      () => {
        setBurst(null)
        setSelected(content)
      },
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650,
    )
    if (!stateOf(date)?.opened_at) {
      writeOpened([...readOpened(), date])
      void patchState(date, { opened_at: new Date().toISOString() }).catch(() => undefined)
    }
  }

  useEffect(() => {
    if (!hint) return
    const t = window.setTimeout(() => setHint(null), 3200)
    return () => window.clearTimeout(t)
  }, [hint])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={root}
          role="dialog"
          aria-modal
          aria-label="Calendrier de l’Avent"
          tabIndex={-1}
          className="fixed inset-0 z-[62] overflow-hidden bg-night/95 outline-none backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="mx-auto flex h-full max-w-[40rem] flex-col px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] tracking-[0.42em] text-gold/90 uppercase">✦ Décembre {year}</p>
                <h2 className="font-display text-[1.9rem] leading-tight">
                  Calendrier <span className="title-accent italic">de l’Avent</span>
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setSnow(!snow)
                    setSnowState(!snow)
                  }}
                  aria-pressed={snow}
                  aria-label={snow ? 'Arrêter la neige' : 'Faire tomber la neige'}
                  className={`press flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-white/5 ${snow ? 'text-starlight' : 'text-mist/50'}`}
                >
                  ❄
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="press flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none text-mist hover:bg-white/5 hover:text-starlight"
                >
                  ×
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm text-mist">
              {openedCount} étoile{openedCount > 1 ? 's' : ''} allumée{openedCount > 1 ? 's' : ''} sur {DAYS}. Touche l’étoile du jour.
            </p>

            {/* Le sapin-constellation */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center py-2">
              {error ? (
                <p className="text-center text-rose">{error}</p>
              ) : (
                <svg
                  viewBox="0 0 300 440"
                  className="h-full max-h-[42rem] w-full overflow-visible"
                  role="group"
                  aria-label="Les 24 étoiles"
                >
                  <defs>
                    <radialGradient id="adv-glow">
                      <stop offset="0%" stopColor="#ffd98a" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#ffd98a" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="adv-glow-blue">
                      <stop offset="0%" stopColor="#7da2ff" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#7da2ff" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  {lines.map(([x1, y1, x2, y2], i) => (
                    <motion.line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#7da2ff"
                      strokeOpacity={0.28}
                      strokeWidth={0.8}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.9, delay: 0.1 + i * 0.04, ease: EASE_OUT }}
                    />
                  ))}

                  {/* Grande étoile au sommet */}
                  <g transform={`translate(${TREE_TOP.x} ${TREE_TOP.y})`} aria-hidden>
                    {allLit && (
                      <motion.circle
                        r={36}
                        fill="url(#adv-glow)"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                    )}
                    <path
                      d="M0 -22 L5 -7 L21 -7 L8 2 L13 18 L0 8 L-13 18 L-8 2 L-21 -7 L-5 -7 Z"
                      fill={allLit ? '#ffd98a' : 'none'}
                      stroke={allLit ? '#fff3d1' : '#7da2ff'}
                      strokeOpacity={allLit ? 1 : 0.45}
                      strokeWidth={1.2}
                      strokeLinejoin="round"
                    />
                  </g>

                  {stars.map((s) => {
                    const date = adventDate(year, s.day)
                    const unlocked = isUnlocked(date, today)
                    const isToday = date === today
                    const done = Boolean(stateOf(date)?.opened_at)
                    const r = isToday ? 9 : done ? 6.5 : unlocked ? 6 : 4
                    return (
                      <g
                        key={s.day}
                        role="button"
                        tabIndex={0}
                        aria-label={`${s.day} décembre${done ? ', déjà ouverte' : unlocked ? ', à ouvrir' : ', pas encore'}`}
                        onClick={() => tapStar(s.day)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tapStar(s.day))}
                        className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-starlight"
                        transform={`translate(${s.x} ${s.y})`}
                      >
                        {/* Zone de toucher confortable */}
                        <circle r={19} fill="transparent" stroke="transparent" strokeWidth={1.5} />
                        {(done || isToday || unlocked) && (
                          <motion.circle
                            r={isToday ? 26 : 16}
                            fill={done ? 'url(#adv-glow)' : 'url(#adv-glow-blue)'}
                            animate={
                              isToday && !done ? { scale: [0.8, 1.25, 0.8], opacity: [0.6, 1, 0.6] } : { opacity: done ? 0.55 : 0.4 }
                            }
                            transition={isToday && !done ? { duration: 1.8, repeat: Infinity } : { duration: 0.4 }}
                          />
                        )}
                        <motion.circle
                          r={r}
                          fill={done ? '#ffe7b0' : unlocked ? '#f4f6ff' : 'rgba(125,162,255,0.25)'}
                          stroke={done ? '#fff3d1' : unlocked ? '#a9c2ff' : 'rgba(125,162,255,0.4)'}
                          strokeWidth={0.8}
                          initial={{ scale: 0 }}
                          animate={burst === s.day ? { scale: [1, 2.2, 0] } : { scale: 1 }}
                          transition={burst === s.day ? { duration: 0.6 } : { ...SPRING_POP, delay: 0.3 + s.day * 0.02 }}
                        />
                        <text
                          y={isToday ? 24 : 19}
                          textAnchor="middle"
                          fontSize={isToday ? 11 : 9}
                          fontFamily="Jost, system-ui, sans-serif"
                          fill={done ? '#ffd98a' : unlocked ? '#f4f6ff' : 'rgba(169,179,224,0.55)'}
                          fontWeight={isToday ? 600 : 400}
                        >
                          {s.day}
                        </text>
                        {burst === s.day && <Burst />}
                      </g>
                    )
                  })}
                </svg>
              )}

              <AnimatePresence>
                {hint && (
                  <motion.p
                    role="status"
                    className="glass absolute bottom-2 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-full px-4 py-2 text-center text-sm"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                  >
                    {hint}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Le contenu de la case */}
          <AnimatePresence>
            {selected && (
              <DayCard
                key={selected.date}
                day={selected}
                state={stateOf(selected.date)}
                onClose={() => setSelected(null)}
                onPatch={(patch) => patchState(selected.date, patch)}
                onPlay={setGame}
              />
            )}
          </AnimatePresence>

          <DenyRun open={game === 'deny'} onClose={() => setGame(null)} festive />
          <JudeShoot open={game === 'jude'} onClose={() => setGame(null)} festive />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Éclat de petites étoiles quand on ouvre une case */
function Burst() {
  return (
    <g aria-hidden>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2
        return (
          <motion.circle
            key={i}
            r={1.8}
            fill={i % 2 ? '#ffd98a' : '#f4f6ff'}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: Math.cos(a) * 34, y: Math.sin(a) * 34, opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          />
        )
      })}
    </g>
  )
}

// ---------- Une case ----------

function DayCard({
  day,
  state,
  onClose,
  onPatch,
  onPlay,
}: {
  day: AdventDay
  state?: AdventState
  onClose: () => void
  onPatch: (patch: Partial<Omit<AdventState, 'date'>>) => Promise<void>
  onPlay: (g: 'deny' | 'jude') => void
}) {
  const card = useRef<HTMLDivElement>(null)
  useDialog(true, card, onClose)
  const n = Number(day.date.slice(8, 10))
  const letter = day.kind === 'lettre'

  return (
    <motion.div
      className="absolute inset-0 z-10 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button type="button" tabIndex={-1} aria-label="Fermer" className="absolute inset-0 bg-night/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        ref={card}
        role="dialog"
        aria-modal
        aria-label={day.title}
        tabIndex={-1}
        className="glass relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] outline-none sm:rounded-[1.75rem] sm:pb-6"
        initial={{ y: 60, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={SPRING}
      >
        <div className="sticky top-0 z-10 -mx-6 -mt-4 mb-2 flex items-center justify-between bg-gradient-to-b from-[#0d1438] from-60% to-transparent px-6 pt-4 pb-3">
          <p className="text-[0.68rem] tracking-[0.42em] text-gold/90 uppercase">✦ {n} décembre</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="press -mr-2 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-mist hover:bg-white/5 hover:text-starlight"
          >
            ×
          </button>
        </div>
        <h3 className={`font-display leading-tight ${letter ? 'text-[2.1rem] italic' : 'text-[1.9rem]'}`}>{day.title}</h3>
        <div className="mt-4">
          <DayContent day={day} state={state} onPatch={onPatch} onPlay={onPlay} />
        </div>
      </motion.div>
    </motion.div>
  )
}

const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

function Prose({ text, big }: { text: string; big?: boolean }) {
  if (!text.trim()) return null
  return (
    <div className={`font-display space-y-[0.7em] leading-relaxed text-starlight/95 ${big ? 'text-[1.3rem]' : 'text-[1.18rem]'}`}>
      {paragraphs(text).map((p, i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.12, duration: 0.5 }}
        >
          {p}
        </motion.p>
      ))}
    </div>
  )
}

function DayContent({
  day,
  state,
  onPatch,
  onPlay,
}: {
  day: AdventDay
  state?: AdventState
  onPatch: (patch: Partial<Omit<AdventState, 'date'>>) => Promise<void>
  onPlay: (g: 'deny' | 'jude') => void
}) {
  const x = day.extra ?? {}
  switch (day.kind) {
    case 'bon':
      return <Coupon day={day} state={state} onPatch={onPatch} />
    case 'souvenir':
      return (
        <div className="space-y-4">
          {x.photo && <PrivateImage path={x.photo} />}
          <Prose text={day.body} />
        </div>
      )
    case 'son':
      return (
        <div className="space-y-5">
          {x.audio ? <Player path={x.audio} title={x.track ?? day.title} /> : <p className="text-sm text-mist">Le son arrive bientôt…</p>}
          <Prose text={day.body} />
        </div>
      )
    case 'film':
      return <FilmOfTheNight day={day} />
    case 'defi':
      return (
        <div className="space-y-5">
          <Prose text={day.body} />
          <DoneToggle state={state} onPatch={onPatch} label="Défi relevé" doneLabel="Défi relevé ✓" />
        </div>
      )
    case 'quiz':
      return <Quiz day={day} />
    case 'jeu':
      return (
        <div className="space-y-5">
          <Prose text={day.body} />
          <button type="button" className="btn-primary" onClick={() => onPlay(x.game ?? 'deny')}>
            {x.game === 'jude' ? '🦌 Jouer avec Jude' : '🎅 Jouer avec Deny'}
          </button>
        </div>
      )
    case 'rdv':
      return <DateNight day={day} />
    case 'voeu':
      return <Wish day={day} state={state} onPatch={onPatch} />
    case 'lettre':
      return (
        <div className="space-y-6">
          <Prose text={day.body} big />
          <p className="font-display text-right text-xl text-glow italic">Valentino ✦</p>
        </div>
      )
    default:
      return <Prose text={day.body} big />
  }
}

function Coupon({ day, state, onPatch }: { day: AdventDay; state?: AdventState; onPatch: (p: Partial<AdventState>) => Promise<void> }) {
  const used = state?.used_at
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-gold/60 bg-gold/[0.06] px-5 py-6 text-center">
        <p className="text-[0.7rem] tracking-[0.4em] text-gold uppercase">Bon pour</p>
        <p className="font-display mt-2 text-[1.9rem] leading-tight">{day.extra?.coupon ?? day.title}</p>
        <p className="mt-3 text-xs text-mist">Valable quand tu veux · sans date d’expiration</p>
        <AnimatePresence>
          {used && (
            <motion.span
              className="absolute top-1/2 left-1/2 rounded-lg border-2 border-rose px-3 py-1 font-semibold tracking-widest text-rose uppercase"
              initial={{ scale: 2, opacity: 0, x: '-50%', y: '-50%', rotate: -18 }}
              animate={{ scale: 1, opacity: 0.9, x: '-50%', y: '-50%', rotate: -14 }}
              transition={SPRING_POP}
            >
              Utilisé
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <Prose text={day.body} />
      {used ? (
        <p className="text-sm text-mist">
          Utilisé le {formatLong(used.slice(0, 10))}.{' '}
          <button
            type="button"
            className="underline underline-offset-4 hover:text-starlight"
            onClick={() => void onPatch({ used_at: null })}
          >
            Annuler
          </button>
        </p>
      ) : (
        <button type="button" className="btn-primary" onClick={() => void onPatch({ used_at: new Date().toISOString() })}>
          Je l’utilise ✦
        </button>
      )}
    </div>
  )
}

function DoneToggle({
  state,
  onPatch,
  label,
  doneLabel,
}: {
  state?: AdventState
  onPatch: (p: Partial<AdventState>) => Promise<void>
  label: string
  doneLabel: string
}) {
  const done = Boolean(state?.used_at)
  return (
    <button
      type="button"
      aria-pressed={done}
      className={done ? 'btn-ghost border-gold/60 text-gold' : 'btn-primary'}
      onClick={() => void onPatch({ used_at: done ? null : new Date().toISOString() })}
    >
      {done ? doneLabel : label}
    </button>
  )
}

function PrivateImage({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    api
      .imageUrls([path])
      .then((u) => setSrc(u[path] ?? null))
      .catch(() => setSrc(null))
  }, [path])
  return (
    <div className="overflow-hidden rounded-2xl border border-glow/20 bg-dusk/60">
      {src ? (
        <motion.img
          src={src}
          alt=""
          className="w-full object-cover"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        />
      ) : (
        <div className="aspect-[4/3] animate-pulse" />
      )}
    </div>
  )
}

/** Lecteur pour tes compositions : gros bouton, barre de progression, et des ondes qui dansent */
function Player({ path, title }: { path: string; title: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    api
      .imageUrls([path])
      .then((u) => setSrc(u[path] ?? null))
      .catch(() => setSrc(null))
  }, [path])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="rounded-2xl border border-glow/20 bg-electric/[0.08] p-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={!src}
          onClick={() => {
            const a = audio.current
            if (!a) return
            if (a.paused) void a.play()
            else a.pause()
          }}
          aria-label={playing ? 'Pause' : 'Écouter'}
          className="press flex h-14 w-14 flex-none items-center justify-center rounded-full bg-electric text-xl text-white shadow-[0_0_24px_rgb(46_91_255/0.55)] disabled:opacity-40"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate">{title}</p>
          <p className="text-xs text-mist">Composé pour toi ✦</p>
          <div className="mt-2 flex h-6 items-end gap-[3px]" aria-hidden>
            {Array.from({ length: 28 }, (_, i) => (
              <motion.span
                key={i}
                className="w-[3px] flex-none rounded-full"
                style={{ background: i / 28 < progress ? '#7da2ff' : 'rgba(169,179,224,0.35)' }}
                animate={playing ? { height: [4, 6 + ((i * 37) % 18), 4] } : { height: 4 + ((i * 37) % 9) }}
                transition={playing ? { duration: 0.7 + (i % 5) * 0.12, repeat: Infinity } : { duration: 0.3 }}
              />
            ))}
          </div>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(progress * 1000)}
        aria-label="Position dans le morceau"
        onChange={(e) => {
          const a = audio.current
          if (a && duration) a.currentTime = (Number(e.target.value) / 1000) * duration
        }}
        className="mt-3 w-full accent-[#7da2ff]"
      />
      <div className="flex justify-between text-xs text-mist tabular-nums">
        <span>{fmt(progress * duration)}</span>
        <span>{duration ? fmt(duration) : '–:––'}</span>
      </div>
      {src && (
        <audio
          ref={audio}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
        />
      )}
    </div>
  )
}

function FilmOfTheNight({ day }: { day: AdventDay }) {
  const navigate = useNavigate()
  const [film, setFilm] = useState<Film | null>(null)
  const wanted = (day.extra?.film ?? '').trim().toLowerCase()
  useEffect(() => {
    if (!wanted) return
    api
      .getFilms()
      .then((all) => setFilm(all.find((f) => f.title.toLowerCase() === wanted || f.original_title?.toLowerCase() === wanted) ?? null))
      .catch(() => setFilm(null))
  }, [wanted])
  const poster = posterUrl(film?.poster_path, 'w342')
  return (
    <div className="space-y-5">
      <div className="flex gap-4">
        <div className="aspect-[2/3] w-28 flex-none overflow-hidden rounded-xl border border-glow/20 bg-dusk/60">
          {poster ? (
            <img src={poster} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl">🎬</div>
          )}
        </div>
        <div className="min-w-0 pt-1">
          <p className="text-xs tracking-[0.3em] text-gold uppercase">Ce soir</p>
          <p className="font-display mt-1 text-2xl leading-tight">{film?.title ?? day.extra?.film}</p>
          {film?.year && <p className="mt-1 text-sm text-mist">{film.year}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {film && (
              <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => navigate(`/cine?c=${film.category_id}`)}>
                Voir dans Ciné
              </button>
            )}
            {(film || day.extra?.film) && (
              <a
                href={letterboxdUrl(film ?? { letterboxd_uri: null, tmdb_id: null, title: day.extra?.film ?? '' })}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost px-3 py-1.5 text-sm"
              >
                Letterboxd
              </a>
            )}
          </div>
        </div>
      </div>
      <Prose text={day.body} />
    </div>
  )
}

function Quiz({ day }: { day: AdventDay }) {
  const questions = day.extra?.questions ?? []
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  if (!questions.length) return <Prose text={day.body} />
  if (i >= questions.length) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-display text-5xl">
          {score} / {questions.length}
        </p>
        <p className="text-mist">
          {score === questions.length
            ? 'Sans faute. Tu te souviens de tout ✦'
            : score
              ? 'Pas mal du tout !'
              : 'On va devoir créer encore plus de souvenirs…'}
        </p>
        <Prose text={day.body} />
      </div>
    )
  }
  const q = questions[i]
  return (
    <div className="space-y-4">
      <p className="text-xs text-mist">
        Question {i + 1} / {questions.length}
      </p>
      <p className="font-display text-[1.4rem] leading-snug">{q.q}</p>
      <div className="grid gap-2">
        {q.options.map((o, k) => {
          const right = picked !== null && k === q.answer
          const wrong = picked === k && k !== q.answer
          return (
            <button
              key={k}
              type="button"
              disabled={picked !== null}
              onClick={() => {
                setPicked(k)
                if (k === q.answer) setScore((s) => s + 1)
              }}
              className={`press rounded-2xl border px-4 py-3 text-left ${
                right ? 'border-gold bg-gold/15' : wrong ? 'border-rose/70 bg-rose/10' : 'border-glow/20 hover:border-glow/50'
              }`}
            >
              {o}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {q.comment && <p className="text-mist">{q.comment}</p>}
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setI(i + 1)
              setPicked(null)
            }}
          >
            {i + 1 < questions.length ? 'Question suivante' : 'Voir mon score'}
          </button>
        </motion.div>
      )}
    </div>
  )
}

/** Rendez-vous du soir : l'heure où je viens te chercher, la tenue, et des indices à dévoiler un par un */
function DateNight({ day }: { day: AdventDay }) {
  const x = day.extra ?? {}
  const clues = x.clues ?? []
  const [shown, setShown] = useState(0)
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-rose/40 bg-rose/[0.07] px-5 py-5 text-center">
        <p className="text-[0.7rem] tracking-[0.4em] text-rose uppercase">Rendez-vous ce soir</p>
        {x.time && (
          <>
            <p className="mt-3 text-sm text-mist">Je viens te chercher à</p>
            <p className="font-display text-[3rem] leading-none tabular-nums lining-nums">{x.time}</p>
          </>
        )}
        {x.outfit && (
          <p className="mt-4">
            <span className="text-sm text-mist">Tenue : </span>
            {x.outfit}
          </p>
        )}
      </div>
      <Prose text={day.body} />
      {clues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs tracking-[0.3em] text-gold uppercase">Indices</p>
          <ol className="space-y-2">
            {clues.slice(0, shown).map((c, k) => (
              <motion.li
                key={k}
                className="rounded-2xl border border-glow/20 px-4 py-3"
                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              >
                <span className="mr-2 text-gold">{k + 1}.</span>
                {c}
              </motion.li>
            ))}
          </ol>
          {shown < clues.length ? (
            <button type="button" className="btn-ghost" onClick={() => setShown(shown + 1)}>
              {shown ? 'Indice suivant' : 'Premier indice'} ({shown + 1}/{clues.length})
            </button>
          ) : (
            <p className="text-sm text-mist">C’est tout ce que tu sauras… à ce soir ✦</p>
          )}
        </div>
      )}
    </div>
  )
}

/** Vœu pour l'année qui vient : scellé jusqu'au 31 décembre */
function Wish({ day, state, onPatch }: { day: AdventDay; state?: AdventState; onPatch: (p: Partial<AdventState>) => Promise<void> }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const year = Number(day.date.slice(0, 4))
  const reveal = todayISO() >= `${year}-12-31`
  const saved = state?.answer
  if (saved) {
    return (
      <div className="space-y-5">
        <Prose text={day.body} />
        <div className="rounded-2xl border border-gold/40 bg-gold/[0.06] px-5 py-5 text-center">
          <p className="text-3xl" aria-hidden>
            {reveal ? '✨' : '✉️'}
          </p>
          {reveal ? (
            <>
              <p className="mt-2 text-xs tracking-[0.3em] text-gold uppercase">Ton vœu pour {year + 1}</p>
              <p className="font-display mt-2 text-[1.4rem] leading-snug">{saved}</p>
            </>
          ) : (
            <p className="mt-2 text-mist">Ton vœu est scellé. Il se dévoilera le 31 décembre, pour le lire ensemble ✦</p>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <Prose text={day.body} />
      <textarea
        className="field min-h-28"
        maxLength={400}
        placeholder={`Ton vœu pour ${year + 1}…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className="btn-primary"
        disabled={busy || !text.trim()}
        onClick={async () => {
          setBusy(true)
          try {
            await onPatch({ answer: text.trim() })
          } finally {
            setBusy(false)
          }
        }}
      >
        Sceller mon vœu ✦
      </button>
    </div>
  )
}
