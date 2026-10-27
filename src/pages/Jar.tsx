import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { IconHeart } from '../components/icons'
import { ErrorNote, Page, Skeleton } from '../components/Page'
import { useLoad } from '../hooks/useLoad'
import { useSettings } from '../context'
import { api, type Reason, type ReasonAuthor } from '../lib/api'
import { drawFromBag, emptyBag, markSeen, uniqueByText, type BagState } from '../lib/bag'
import { diffDays, todayISO } from '../lib/dates'

// Tirages déjà faits sur cet appareil, conservés entre les visites (un sac par bocal)
const bagKey = (author: ReasonAuthor) => (author === 'him' ? 'stella.jar.seen' : 'stella.jar.seen.her')
const TAB_KEY = 'stella.jar.tab'
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const readBag = (author: ReasonAuthor): BagState => {
  try {
    const v = JSON.parse(localStorage.getItem(bagKey(author)) ?? 'null')
    if (Array.isArray(v)) return { seen: strings(v), cooldown: [] } // ancien format
    if (v && typeof v === 'object') return { seen: strings(v.seen), cooldown: strings(v.cooldown) }
  } catch {
    /* illisible : on repart de zéro */
  }
  return emptyBag()
}
const writeBag = (author: ReasonAuthor, state: BagState) => {
  try {
    localStorage.setItem(bagKey(author), JSON.stringify(state))
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
function reasonOfTheDay(reasons: Reason[], seed: number): Reason {
  const order = [...reasons]
  const rand = rng(seed)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const day = diffDays(todayISO(), '2026-01-01')
  return order[((day % order.length) + order.length) % order.length]
}

const readTab = (): ReasonAuthor => {
  try {
    return localStorage.getItem(TAB_KEY) === 'her' ? 'her' : 'him'
  } catch {
    return 'him'
  }
}

export function Jar() {
  const { her_name, his_name } = useSettings()
  const { data, error, loading, reload, setData } = useLoad(api.getReasons, 'reasons')
  const [author, setAuthor] = useState<ReasonAuthor>(readTab)
  const her = her_name || 'elle'
  const him = his_name || 'lui'
  const panelId = useId()

  const choose = (a: ReasonAuthor) => {
    setAuthor(a)
    try {
      localStorage.setItem(TAB_KEY, a)
    } catch {
      /* rien à retenir */
    }
  }

  // Les anciennes raisons (avant le 2e bocal) sont les siennes à lui
  const list = useMemo(() => (data ? uniqueByText(data.filter((r) => (r.author ?? 'him') === author)) : null), [data, author])

  const actions: JarActions = {
    add: async (text) => {
      const r = await api.addReason(text, author)
      setData((d) => [...(d ?? []), r])
      void reload()
    },
    update: async (id, text) => {
      await api.updateReason(id, text)
      setData((d) => (d ?? []).map((r) => (r.id === id ? { ...r, text } : r)))
      void reload()
    },
    remove: async (id) => {
      await api.deleteReason(id)
      setData((d) => (d ?? []).filter((r) => r.id !== id))
      void reload()
    },
  }

  const tabs: { id: ReasonAuthor; label: string }[] = [
    { id: 'him', label: `Pour ${her}` },
    { id: 'her', label: `Pour ${him}` },
  ]

  return (
    <Page
      wide
      title="Le bocal"
      intro="Une raison par jour. Et d’autres, quand tu en as besoin."
    >
      <div role="tablist" aria-label="Choisir le bocal" className="glass -mt-2 mb-8 inline-flex rounded-full p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${panelId}-${t.id}`}
            aria-selected={author === t.id}
            aria-controls={panelId}
            onClick={() => choose(t.id)}
            className={`rounded-full px-5 py-2 text-sm transition-colors ${author === t.id ? 'bg-electric text-white' : 'text-mist hover:text-starlight'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={`${panelId}-${author}`}>
        {loading && <Skeleton variant="jar" />}
        {error && <ErrorNote message={error} onRetry={reload} />}
        {list && list.length === 0 && <EmptyJar author={author} owner={author === 'him' ? him : her} actions={actions} />}
        {list && list.length > 0 && <JarContent key={author} author={author} reasons={list} actions={actions} />}
      </div>
    </Page>
  )
}

interface JarActions {
  add: (text: string) => Promise<void>
  update: (id: string, text: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

function EmptyJar({ author, owner, actions }: { author: ReasonAuthor; owner: string; actions: JarActions }) {
  const [writing, setWriting] = useState(false)
  return (
    <div className="flex flex-col items-center text-center">
      <JarArt count={0} author={author} />
      <p className="mt-6 max-w-[30ch] text-mist">Ce bocal attend encore la première raison de {owner}.</p>
      <button type="button" className="btn-primary mt-5" onClick={() => setWriting(true)}>
        Écrire la première raison
      </button>
      <ReasonEditor open={writing} onClose={() => setWriting(false)} onSave={actions.add} />
    </div>
  )
}

function JarContent({ reasons, author, actions }: { reasons: Reason[]; author: ReasonAuthor; actions: JarActions }) {
  const today = useMemo(() => reasonOfTheDay(reasons, author === 'him' ? 46 : 47), [reasons, author])
  const ids = useMemo(() => reasons.map((r) => r.id), [reasons])
  const [currentId, setCurrentId] = useState(today.id)
  const current = reasons.find((r) => r.id === currentId) ?? today
  const [writing, setWriting] = useState(false)
  const [managing, setManaging] = useState(false)
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
    writeBag(author, markSeen(ids, readBag(author), today.id))
  }, [ids, today.id, author])

  const draw = () => {
    if (reasons.length < 2) return
    const { id, state } = drawFromBag(ids, readBag(author))
    writeBag(author, state)
    setCurrentId(id)
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
        <JarArt count={reasons.length} author={author} />
        <span className="btn-ghost mt-5">Tirer une autre raison</span>
      </button>

      <div className="mt-6 flex flex-col items-center lg:col-start-2 lg:mt-0">
        <div className="flex flex-wrap justify-center gap-x-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 py-2 text-sm text-mist hover:text-starlight"
            onClick={() => setShowFavs(true)}
          >
            <IconHeart width={16} height={16} filled={favorites.length > 0} className="text-rose" />
            Préférées{favorites.length > 0 ? ` (${favorites.length})` : ''}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 py-2 text-sm text-mist hover:text-starlight"
            onClick={() => setWriting(true)}
          >
            <span aria-hidden className="text-glow">
              ✎
            </span>{' '}
            Écrire une raison
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 py-2 text-sm text-mist hover:text-starlight"
            onClick={() => setManaging(true)}
          >
            <span aria-hidden className="text-glow">
              ☰
            </span>{' '}
            Tout voir
          </button>
        </div>
        {favError && (
          <p role="alert" className="mt-1 text-center text-sm text-rose">
            Impossible d’enregistrer le favori : {favError}
          </p>
        )}
      </div>

      <ReasonEditor open={writing} onClose={() => setWriting(false)} onSave={actions.add} />
      <ManageReasons open={managing} onClose={() => setManaging(false)} reasons={reasons} actions={actions} />

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

const PAPERS: Record<ReasonAuthor, string[]> = {
  him: ['#F4F6FF', '#7DA2FF', '#FFD98A', '#C9D6FF'],
  her: ['#FF9BBE', '#FFD98A', '#F4F6FF', '#C9B6FF'],
}

function JarArt({ count, author }: { count: number; author: ReasonAuthor }) {
  const papers = useMemo(() => {
    const rand = rng(7)
    const n = Math.min(count, 60)
    return Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / 6)
      return {
        x: 38 + (i % 6) * 15 + (rand() - 0.5) * 8,
        y: 196 - row * 12 + (rand() - 0.5) * 6,
        r: (rand() - 0.5) * 70,
        c: PAPERS[author][Math.floor(rand() * 4)],
      }
    })
  }, [count, author])

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

/** Fenêtre pour écrire ou corriger une raison. */
function ReasonEditor({
  open,
  onClose,
  onSave,
  initial = '',
  title = 'Écrire une raison',
}: {
  open: boolean
  onClose: () => void
  onSave: (text: string) => Promise<void>
  initial?: string
  title?: string
}) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const id = useId()

  useEffect(() => {
    if (open) {
      setText(initial)
      setErr(null)
    }
  }, [open, initial])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = text.trim()
    if (!clean) return
    setBusy(true)
    setErr(null)
    try {
      await onSave(clean)
      onClose()
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x))
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} label={title}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <h2 className="font-display text-3xl font-medium">{title}</h2>
        <label htmlFor={id} className="text-sm text-mist">
          Parce que…
        </label>
        <textarea
          id={id}
          data-autofocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={400}
          placeholder="Parce que tu…"
          className="font-display w-full resize-none rounded-2xl border border-glow/25 bg-starlight/[0.04] px-4 py-3 text-[1.25rem] leading-snug text-starlight placeholder:text-mist/60 focus:border-glow focus:outline-none"
        />
        {err && (
          <p role="alert" className="text-sm text-rose">
            Impossible d’enregistrer : {err}
          </p>
        )}
        <button type="submit" disabled={busy || !text.trim()} className="btn-primary self-start disabled:opacity-50">
          {busy ? 'Enregistrement…' : 'Mettre dans le bocal'}
        </button>
      </form>
    </BottomSheet>
  )
}

/** Liste complète d'un bocal : corriger ou retirer une raison. */
function ManageReasons({
  open,
  onClose,
  reasons,
  actions,
}: {
  open: boolean
  onClose: () => void
  reasons: Reason[]
  actions: JarActions
}) {
  const [editing, setEditing] = useState<Reason | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const remove = async (id: string) => {
    setErr(null)
    try {
      await actions.remove(id)
      setConfirm(null)
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x))
    }
  }

  return (
    <>
      <BottomSheet open={open && !editing} onClose={onClose} label="Toutes les raisons">
        <h2 className="font-display text-3xl font-medium">Toutes les raisons</h2>
        {err && (
          <p role="alert" className="mt-2 text-sm text-rose">
            Impossible de retirer la raison : {err}
          </p>
        )}
        <ul className="mt-5 space-y-3">
          {reasons.map((r) => (
            <li key={r.id} className="rounded-[1rem] border border-glow/15 bg-starlight/[0.04] px-5 py-4">
              <p className="font-display text-[1.2rem] leading-snug">{r.text}</p>
              {confirm === r.id ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-mist">Retirer cette raison du bocal ?</span>
                  <button type="button" className="rounded-full bg-rose/90 px-4 py-1.5 text-white" onClick={() => void remove(r.id)}>
                    Oui, retirer
                  </button>
                  <button type="button" className="px-2 py-1.5 text-mist hover:text-starlight" onClick={() => setConfirm(null)}>
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex gap-4 text-sm">
                  <button type="button" className="py-1.5 text-glow hover:text-starlight" onClick={() => setEditing(r)}>
                    Modifier
                  </button>
                  <button type="button" className="py-1.5 text-mist hover:text-rose" onClick={() => setConfirm(r.id)}>
                    Retirer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </BottomSheet>
      <ReasonEditor
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        initial={editing?.text ?? ''}
        title="Modifier la raison"
        onSave={(text) => actions.update(editing!.id, text)}
      />
    </>
  )
}
