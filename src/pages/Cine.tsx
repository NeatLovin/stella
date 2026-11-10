import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet'
import { IconExternal, IconFilm, IconPlus } from '../components/icons'
import { ErrorNote, Page, Skeleton } from '../components/Page'
import { useDialog } from '../hooks/useDialog'
import { useLoad } from '../hooks/useLoad'
import { api, isDemo } from '../lib/api'
import {
  draw,
  eligible,
  filmDetails,
  formatRuntime,
  letterboxdUrl,
  posterUrl,
  resolveFilm,
  searchFilms,
  type DrawFilter,
  type Film,
  type FilmCategory,
  type SearchResult,
} from '../lib/films'
import { EASE_OUT, SPRING_POP } from '../lib/motion'

interface CineData {
  categories: FilmCategory[]
  films: Film[]
}
const loadCine = async (): Promise<CineData> => {
  const [categories, films] = await Promise.all([api.getFilmCategories(), api.getFilms()])
  return { categories, films }
}

type CatEditing = { mode: 'new' } | { mode: 'edit'; cat: FilmCategory }
/** Films montrés dans chaque rangée avant « Tout voir » */
const ROW_MAX = 12

export function Cine() {
  const { data, error, loading, reload, setData } = useLoad(loadCine, 'cine')
  const [token, setToken] = useState<string | null>(null)
  // Catégorie ouverte dans l'adresse (?c=…) : le retour arrière du téléphone ramène à toutes les catégories
  const [params, setParams] = useSearchParams()
  const [openFilm, setOpenFilm] = useState<Film | null>(null)
  const [addingTo, setAddingTo] = useState<FilmCategory | null>(null)
  const [catEditing, setCatEditing] = useState<CatEditing | null>(null)
  // undefined : fermé ; null : toutes les catégories ; sinon la catégorie de départ du tirage
  const [drawFrom, setDrawFrom] = useState<string | null | undefined>(undefined)

  // Le jeton TMDB n'est jamais gardé dans le cache de l'appareil
  useEffect(() => {
    api
      .getTmdbToken()
      .then(setToken)
      .catch(() => setToken(null))
  }, [])

  const categories = useMemo(() => [...(data?.categories ?? [])].sort((a, b) => a.position - b.position), [data])
  const films = useMemo(() => data?.films ?? [], [data])
  const byCat = useMemo(() => {
    const m = new Map<string, Film[]>()
    for (const f of films) m.set(f.category_id, [...(m.get(f.category_id) ?? []), f])
    return m
  }, [films])
  const opened = categories.find((c) => c.id === params.get('c')) ?? null

  const openCat = (id: string | null) => {
    if (id) setParams({ c: id })
    else if (params.get('c')) window.history.back()
    window.scrollTo({ top: 0 })
  }

  const patchFilm = (id: string, patch: Partial<Film>) =>
    setData((d) => d && { ...d, films: d.films.map((f) => (f.id === id ? { ...f, ...patch } : f)) })

  // Films ajoutés par leur seul titre : on retrouve affiche, résumé et durée sur TMDB, une seule fois
  const resolving = useRef(new Set<string>())
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )
  useEffect(() => {
    if (!token || !data) return
    const queue = data.films.filter((f) => f.tmdb_id === null && !resolving.current.has(f.id))
    if (!queue.length) return
    queue.forEach((f) => resolving.current.add(f.id))
    const worker = async () => {
      while (mounted.current && queue.length) {
        const f = queue.shift()!
        try {
          const details = await resolveFilm(token, f)
          await api.updateFilm(f.id, details)
          if (mounted.current) patchFilm(f.id, details)
        } catch {
          /* on réessaiera à la prochaine visite */
        }
      }
    }
    void Promise.all([worker(), worker(), worker(), worker()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, data])

  // Monter / descendre une catégorie : on renumérote toutes les positions
  const moveCategory = async (id: string, d: -1 | 1) => {
    const order = [...categories]
    const i = order.findIndex((c) => c.id === id)
    const j = i + d
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    const changed = order
      .map((c, k) => ({ ...c, position: k + 1 }))
      .filter((c, k) => categories.find((x) => x.id === c.id)!.position !== k + 1)
    await Promise.all(changed.map((c) => api.updateFilmCategory(c.id, { position: c.position })))
    setData((dd) => dd && { ...dd, categories: dd.categories.map((c) => changed.find((x) => x.id === c.id) ?? c) })
  }

  const pending = films.filter((f) => f.tmdb_id === null).length
  const shown = opened ? (byCat.get(opened.id) ?? []) : []

  return (
    <Page title="Ciné à deux" intro="Nos films à regarder ensemble, rangés par envie." wide>
      {loading && !data ? (
        <Skeleton variant="cards" />
      ) : error && !data ? (
        <ErrorNote message={error} onRetry={reload} />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {opened ? (
            // ----- Une catégorie en entier -----
            <motion.div
              key={opened.id}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => openCat(null)}
                  className="press -ml-2 flex items-center gap-1 rounded-full px-2 py-1 text-sm text-glow hover:text-starlight"
                >
                  <span className="text-lg leading-none" aria-hidden>
                    ‹
                  </span>{' '}
                  Toutes les catégories
                </button>
                <button
                  type="button"
                  className="press -mr-2 rounded-full px-2 py-1 text-sm text-mist hover:text-starlight"
                  onClick={() => setCatEditing({ mode: 'edit', cat: opened })}
                >
                  Modifier
                </button>
              </div>
              <div className="mb-6">
                <h2 className="font-display text-[2rem] leading-tight">
                  <span aria-hidden>{opened.emoji} </span>
                  {opened.name}
                </h2>
                {opened.blurb && <p className="mt-1 max-w-[40ch] text-mist">{opened.blurb}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary px-4 py-2 text-sm"
                    onClick={() => setDrawFrom(opened.id)}
                    disabled={!shown.length}
                  >
                    <span aria-hidden>🎲</span> Tirer au sort
                  </button>
                  <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => setAddingTo(opened)}>
                    <IconPlus width={16} height={16} /> Ajouter un film
                  </button>
                </div>
              </div>
              {shown.length ? (
                <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 lg:gap-x-5 lg:gap-y-8">
                  <AnimatePresence initial>
                    {shown.map((f, i) => (
                      <motion.li
                        key={f.id}
                        layout
                        initial={{ opacity: 0, y: 16, scale: 0.96 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          transition: { delay: Math.min(i, 12) * 0.03, duration: 0.45, ease: EASE_OUT },
                        }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                      >
                        <FilmCard film={f} onOpen={() => setOpenFilm(f)} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              ) : (
                <p className="text-mist">Aucun film ici pour l’instant. Ajoutez-en un !</p>
              )}
            </motion.div>
          ) : (
            // ----- Toutes les catégories, en rangées -----
            <motion.div
              key="all"
              initial={{ opacity: 0, x: -32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              <button
                type="button"
                className="btn-primary mb-8 w-full sm:w-auto"
                onClick={() => setDrawFrom(null)}
                disabled={!films.length}
              >
                <span aria-hidden>🎲</span> Ce soir on regarde quoi ?
              </button>

              {!token && !isDemo && pending > 0 && (
                <p className="mb-6 rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-mist">
                  Les affiches arriveront dès que la clé TMDB sera enregistrée dans les réglages.
                </p>
              )}

              {categories.length ? (
                <div className="space-y-10">
                  {categories.map((c, i) => (
                    <CategoryRow
                      key={c.id}
                      cat={c}
                      films={byCat.get(c.id) ?? []}
                      index={i}
                      onOpen={() => openCat(c.id)}
                      onFilm={setOpenFilm}
                      onAdd={() => setAddingTo(c)}
                    />
                  ))}
                </div>
              ) : (
                <div className="glass rounded-3xl px-6 py-10 text-center">
                  <IconFilm width={36} height={36} className="mx-auto text-glow" />
                  <p className="mt-4 text-mist">Créez une première catégorie pour commencer vos listes.</p>
                </div>
              )}

              <button type="button" className="btn-ghost mt-10" onClick={() => setCatEditing({ mode: 'new' })}>
                <IconPlus width={16} height={16} /> Nouvelle catégorie
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <BottomSheet open={Boolean(openFilm)} onClose={() => setOpenFilm(null)} label={openFilm?.title ?? 'Film'}>
        {openFilm && (
          <FilmSheet
            key={openFilm.id}
            film={films.find((f) => f.id === openFilm.id) ?? openFilm}
            categories={categories}
            onMove={async (category_id) => {
              await api.updateFilm(openFilm.id, { category_id })
              patchFilm(openFilm.id, { category_id })
            }}
            onRemove={async () => {
              await api.deleteFilm(openFilm.id)
              setData((d) => d && { ...d, films: d.films.filter((f) => f.id !== openFilm.id) })
              setOpenFilm(null)
            }}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={Boolean(addingTo)}
        onClose={() => setAddingTo(null)}
        label={`Ajouter un film${addingTo ? ` · ${addingTo.name}` : ''}`}
      >
        {addingTo && (
          <AddFilm
            token={token}
            category={addingTo}
            existing={byCat.get(addingTo.id) ?? []}
            onAdd={async (input) => {
              const position = Math.max(0, ...films.map((f) => f.position)) + 1
              const film = await api.addFilm({ ...input, category_id: addingTo.id, position })
              setData((d) => d && { ...d, films: [...d.films, film] })
            }}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={Boolean(catEditing)}
        onClose={() => setCatEditing(null)}
        label={catEditing?.mode === 'edit' ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      >
        {catEditing && (
          <CategoryForm
            key={catEditing.mode === 'edit' ? catEditing.cat.id : 'new'}
            cat={catEditing.mode === 'edit' ? catEditing.cat : undefined}
            count={catEditing.mode === 'edit' ? (byCat.get(catEditing.cat.id)?.length ?? 0) : 0}
            rank={catEditing.mode === 'edit' ? categories.findIndex((c) => c.id === catEditing.cat.id) : -1}
            total={categories.length}
            onReorder={catEditing.mode === 'edit' ? (d) => moveCategory(catEditing.cat.id, d) : undefined}
            onSave={async (values) => {
              if (catEditing.mode === 'edit') {
                await api.updateFilmCategory(catEditing.cat.id, values)
                setData((d) => d && { ...d, categories: d.categories.map((c) => (c.id === catEditing.cat.id ? { ...c, ...values } : c)) })
              } else {
                const position = Math.max(0, ...categories.map((c) => c.position)) + 1
                const cat = await api.addFilmCategory({ ...values, position })
                setData((d) => d && { ...d, categories: [...d.categories, cat] })
                openCat(cat.id)
              }
              setCatEditing(null)
            }}
            onDelete={
              catEditing.mode === 'edit'
                ? async () => {
                    const id = catEditing.cat.id
                    await api.deleteFilmCategory(id)
                    setData(
                      (d) =>
                        d && { categories: d.categories.filter((c) => c.id !== id), films: d.films.filter((f) => f.category_id !== id) },
                    )
                    setCatEditing(null)
                    if (opened?.id === id) openCat(null)
                  }
                : undefined
            }
          />
        )}
      </BottomSheet>

      <DrawOverlay
        open={drawFrom !== undefined}
        onClose={() => setDrawFrom(undefined)}
        films={films}
        categories={categories}
        initialCategory={drawFrom ?? null}
      />
    </Page>
  )
}

/** Une rangée façon Netflix : en-tête cliquable et affiches qui défilent du doigt. */
function CategoryRow({
  cat,
  films,
  index,
  onOpen,
  onFilm,
  onAdd,
}: {
  cat: FilmCategory
  films: Film[]
  index: number
  onOpen: () => void
  onFilm: (f: Film) => void
  onAdd: () => void
}) {
  const visible = films.slice(0, ROW_MAX)
  const more = films.length - visible.length
  const scroller = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })
  const update = () => {
    const el = scroller.current
    if (!el) return
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 })
  }
  useEffect(() => {
    update()
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [films.length])
  const page = (d: -1 | 1) => scroller.current?.scrollBy({ left: d * scroller.current.clientWidth * 0.85, behavior: 'smooth' })
  const arrow = (d: -1 | 1) => (
    <button
      type="button"
      onClick={() => page(d)}
      aria-label={d < 0 ? `Films précédents · ${cat.name}` : `Films suivants · ${cat.name}`}
      className={`press glass absolute top-[38%] z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-2xl leading-none text-starlight shadow-[0_6px_20px_rgb(0_0_0/0.4)] transition-opacity [@media(hover:hover)]:flex ${
        d < 0 ? '-left-3' : '-right-3'
      } ${(d < 0 ? edges.start : edges.end) ? 'pointer-events-none opacity-0' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100'}`}
    >
      <span aria-hidden>{d < 0 ? '‹' : '›'}</span>
    </button>
  )
  return (
    <motion.section
      aria-label={cat.name}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay: Math.min(index, 3) * 0.06 }}
    >
      <button type="button" onClick={onOpen} className="group flex w-full items-end justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="font-display block truncate text-[1.6rem] leading-tight">
            <span aria-hidden>{cat.emoji} </span>
            {cat.name}
          </span>
          {cat.blurb && <span className="mt-0.5 block truncate text-sm text-mist">{cat.blurb}</span>}
        </span>
        <span className="flex flex-none items-center gap-1 pb-0.5 text-sm text-glow transition-transform group-hover:translate-x-0.5">
          {films.length} film{films.length > 1 ? 's' : ''}
          <span className="text-lg leading-none" aria-hidden>
            ›
          </span>
          <span className="sr-only">, tout voir</span>
        </span>
      </button>

      <div className="group/row relative">
        {arrow(-1)}
        {arrow(1)}
        <div
          ref={scroller}
          onScroll={update}
          className={`-mx-5 mt-3 snap-x snap-mandatory scroll-px-5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] lg:mx-0 lg:scroll-px-0 lg:px-0 [&::-webkit-scrollbar]:hidden ${
            edges.end ? '' : 'lg:[mask-image:linear-gradient(to_right,black_88%,transparent)]'
          }`}
        >
          <ul className="flex w-max gap-3 lg:gap-4">
            {visible.map((f) => (
              <li key={f.id} className="w-[26vw] max-w-[9.5rem] flex-none snap-start">
                <FilmCard film={f} onOpen={() => onFilm(f)} compact />
              </li>
            ))}
            <li className="w-[26vw] max-w-[9.5rem] flex-none snap-start">
              <button
                type="button"
                onClick={more > 0 ? onOpen : onAdd}
                className="press flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-glow/30 text-sm text-mist hover:border-glow/60 hover:text-starlight"
              >
                {more > 0 ? (
                  <>
                    <span className="font-display text-2xl text-starlight">+{more}</span>
                    Tout voir
                  </>
                ) : (
                  <>
                    <IconPlus width={22} height={22} />
                    Ajouter
                  </>
                )}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </motion.section>
  )
}

// ---------- Affiche ----------

function Poster({
  film,
  size = 'w342',
  className = '',
  eager,
}: {
  film: Pick<Film, 'poster_path' | 'title'>
  size?: 'w185' | 'w342' | 'w500'
  className?: string
  /** Chargée tout de suite et affichée sans fondu (roulette du tirage) */
  eager?: boolean
}) {
  const src = posterUrl(film.poster_path, size)
  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-xl border border-glow/15 bg-dusk/70 ${className}`}>
      {src ? (
        <img
          src={src}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          draggable={false}
          className={`h-full w-full object-cover ${eager ? '' : 'opacity-0 transition-opacity duration-700 data-[loaded=true]:opacity-100'}`}
          onLoad={(e) => (e.currentTarget.dataset.loaded = 'true')}
          ref={(el) => {
            if (el?.complete && el.naturalWidth) el.dataset.loaded = 'true'
          }}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_50%_30%,rgb(46_91_255/0.35),transparent_70%)] p-2 text-center">
          <IconFilm width={22} height={22} className="text-glow/70" />
          <span className="font-display line-clamp-4 text-[0.95rem] leading-tight">{film.title}</span>
        </div>
      )}
    </div>
  )
}

function FilmCard({ film, onOpen, compact }: { film: Film; onOpen: () => void; compact?: boolean }) {
  const meta = compact ? (film.year ? String(film.year) : '') : [film.year, formatRuntime(film.runtime)].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full text-left"
      aria-label={`${film.title}${film.year ? ` (${film.year})` : ''}`}
    >
      <Poster
        film={film}
        className="transition-[transform,box-shadow] duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_14px_40px_rgb(46_91_255/0.3)]"
      />
      <p className={`mt-2 leading-snug ${compact ? 'line-clamp-1 text-[0.85rem]' : 'line-clamp-2 text-[0.9rem]'}`}>{film.title}</p>
      {meta && <p className="mt-0.5 text-xs text-mist">{meta}</p>}
    </button>
  )
}

// ---------- Fiche d'un film ----------

function FilmSheet({
  film,
  categories,
  onMove,
  onRemove,
}: {
  film: Film
  categories: FilmCategory[]
  onMove: (categoryId: string) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Une erreur est survenue')
    } finally {
      setBusy(false)
    }
  }
  const meta = [film.year, formatRuntime(film.runtime)].filter(Boolean).join(' · ')

  return (
    <div className="space-y-5">
      <div className="flex gap-4">
        <Poster film={film} size="w342" className="w-28 flex-none sm:w-36" />
        <div className="min-w-0 pt-1">
          <h2 className="font-display text-2xl leading-tight">{film.title}</h2>
          {film.original_title && film.original_title !== film.title && (
            <p className="mt-1 text-sm text-mist italic">{film.original_title}</p>
          )}
          {meta && <p className="mt-2 text-sm text-mist">{meta}</p>}
          <a href={letterboxdUrl(film)} target="_blank" rel="noreferrer" className="btn-ghost mt-4 px-4 py-2 text-sm">
            Voir sur Letterboxd <IconExternal width={15} height={15} />
          </a>
        </div>
      </div>

      {film.overview && <p className="leading-relaxed text-starlight/90">{film.overview}</p>}

      <label className="block">
        <span className="mb-2 block text-xs tracking-[0.2em] text-mist uppercase">Catégorie</span>
        <select className="field" value={film.category_id} disabled={busy} onChange={(e) => void run(() => onMove(e.target.value))}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </label>

      {confirm ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-mist">Retirer ce film de la liste ?</span>
          <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={busy} onClick={() => void run(onRemove)}>
            Oui, retirer
          </button>
          <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => setConfirm(false)}>
            Annuler
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="text-sm text-mist underline-offset-4 hover:text-starlight hover:underline"
          onClick={() => setConfirm(true)}
        >
          Retirer de la liste
        </button>
      )}
      {err && <p className="text-sm text-rose">{err}</p>}
    </div>
  )
}

// ---------- Ajouter un film ----------

function AddFilm({
  token,
  category,
  existing,
  onAdd,
}: {
  token: string | null
  category: FilmCategory
  existing: Film[]
  onAdd: (f: Omit<Film, 'id' | 'category_id' | 'position'>) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [added, setAdded] = useState<Set<number>>(new Set())
  const [busyId, setBusyId] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [year, setYear] = useState('')

  // Recherche TMDB pendant la frappe (petite pause pour ne pas chercher à chaque lettre)
  useEffect(() => {
    if (!token) return
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    let alive = true
    setSearching(true)
    const t = window.setTimeout(() => {
      searchFilms(token, q)
        .then((r) => alive && setResults(r))
        .catch((e) => alive && setErr(e instanceof Error ? e.message : 'Recherche impossible'))
        .finally(() => alive && setSearching(false))
    }, 350)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [query, token])

  const inList = (id: number) => added.has(id) || existing.some((f) => f.tmdb_id === id)

  const pick = async (r: SearchResult) => {
    if (!token || inList(r.tmdb_id)) return
    setBusyId(r.tmdb_id)
    setErr(null)
    try {
      const details = await filmDetails(token, r.tmdb_id)
      await onAdd({ ...details, letterboxd_uri: null })
      setAdded((s) => new Set(s).add(r.tmdb_id))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ajout impossible')
    } finally {
      setBusyId(null)
    }
  }

  // Sans clé TMDB : ajout par titre, l'affiche sera retrouvée plus tard
  const addManual = async (e: FormEvent) => {
    e.preventDefault()
    const title = query.trim()
    if (!title) return
    setErr(null)
    try {
      await onAdd({
        title,
        original_title: null,
        year: /^\d{4}$/.test(year) ? Number(year) : null,
        tmdb_id: null,
        poster_path: null,
        overview: null,
        runtime: null,
        letterboxd_uri: null,
      })
      setQuery('')
      setYear('')
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Ajout impossible')
    }
  }

  if (!token) {
    return (
      <form onSubmit={addManual} className="space-y-4">
        <p className="text-sm text-mist">
          Dans « {category.name} ». La recherche avec affiches arrive avec la clé TMDB ; en attendant, ajoute le film par son titre.
        </p>
        <input className="field" placeholder="Titre du film" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <input
          className="field"
          placeholder="Année (facultatif)"
          inputMode="numeric"
          maxLength={4}
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
        <button type="submit" className="btn-primary w-full" disabled={!query.trim()}>
          Ajouter
        </button>
        {err && <p className="text-sm text-rose">{err}</p>}
      </form>
    )
  }

  return (
    <div className="space-y-4">
      <input
        className="field"
        type="search"
        placeholder="Chercher un film…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setErr(null)
        }}
        autoFocus
        aria-label="Chercher un film"
      />
      <p aria-live="polite" className="h-4 text-xs text-mist">
        {searching ? 'Recherche…' : query.trim().length >= 2 && !results.length ? 'Aucun film trouvé.' : ''}
      </p>
      <ul className="space-y-2">
        {results.map((r) => {
          const done = inList(r.tmdb_id)
          return (
            <li key={r.tmdb_id}>
              <button
                type="button"
                disabled={done || busyId !== null}
                onClick={() => void pick(r)}
                className="press flex w-full items-center gap-3 rounded-2xl border border-glow/15 p-2 text-left hover:border-glow/45 disabled:hover:border-glow/15"
              >
                <span className="w-11 flex-none">
                  <Poster film={r} size="w185" className="rounded-lg" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{r.title}</span>
                  <span className="block truncate text-xs text-mist">
                    {[r.year, r.original_title !== r.title ? r.original_title : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex-none pr-2 text-sm text-glow">
                  {busyId === r.tmdb_id ? (
                    '…'
                  ) : done ? (
                    <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={SPRING_POP} className="inline-block">
                      Ajouté ✓
                    </motion.span>
                  ) : (
                    <IconPlus width={18} height={18} />
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {err && <p className="text-sm text-rose">{err}</p>}
    </div>
  )
}

// ---------- Catégorie ----------

function CategoryForm({
  cat,
  count,
  rank,
  total,
  onReorder,
  onSave,
  onDelete,
}: {
  cat?: FilmCategory
  count: number
  rank: number
  total: number
  onReorder?: (d: -1 | 1) => Promise<void>
  onSave: (v: { name: string; emoji: string; blurb: string }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState(cat?.name ?? '')
  const [emoji, setEmoji] = useState(cat?.emoji ?? '🎬')
  const [blurb, setBlurb] = useState(cat?.blurb ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Une erreur est survenue')
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) void run(() => onSave({ name: name.trim(), emoji: emoji.trim() || '🎬', blurb: blurb.trim() }))
      }}
    >
      <div className="flex gap-3">
        <label className="w-20 flex-none">
          <span className="mb-2 block text-xs tracking-[0.2em] text-mist uppercase">Emoji</span>
          <input className="field text-center text-xl" maxLength={4} value={emoji} onChange={(e) => setEmoji(e.target.value)} />
        </label>
        <label className="min-w-0 flex-1">
          <span className="mb-2 block text-xs tracking-[0.2em] text-mist uppercase">Nom</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Classic banger" autoFocus={!cat} />
        </label>
      </div>
      <label className="block">
        <span className="mb-2 block text-xs tracking-[0.2em] text-mist uppercase">Petite phrase</span>
        <input
          className="field"
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          placeholder="Sous la couette, avec un chocolat chaud"
        />
      </label>
      {onReorder && total > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-glow/15 px-4 py-2.5">
          <span className="text-sm text-mist">
            Place dans la liste : {rank + 1} / {total}
          </span>
          <span className="flex gap-1">
            <button
              type="button"
              className="press rounded-full px-3 py-1.5 text-sm text-glow disabled:opacity-30"
              disabled={busy || rank <= 0}
              onClick={() => void run(() => onReorder(-1).then(() => setBusy(false)))}
              aria-label="Monter la catégorie"
            >
              ↑ Monter
            </button>
            <button
              type="button"
              className="press rounded-full px-3 py-1.5 text-sm text-glow disabled:opacity-30"
              disabled={busy || rank >= total - 1}
              onClick={() => void run(() => onReorder(1).then(() => setBusy(false)))}
              aria-label="Descendre la catégorie"
            >
              ↓ Descendre
            </button>
          </span>
        </div>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy || !name.trim()}>
        {cat ? 'Enregistrer' : 'Créer la catégorie'}
      </button>
      {onDelete &&
        (confirm ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-mist">
              Supprimer « {cat?.name} »{count ? ` et ses ${count} film${count > 1 ? 's' : ''}` : ''} ?
            </span>
            <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={busy} onClick={() => void run(onDelete)}>
              Oui, supprimer
            </button>
            <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => setConfirm(false)}>
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-sm text-mist underline-offset-4 hover:text-starlight hover:underline"
            onClick={() => setConfirm(true)}
          >
            Supprimer la catégorie
          </button>
        ))}
      {err && <p className="text-sm text-rose">{err}</p>}
    </form>
  )
}

// ---------- Tirage au sort ----------

const DURATIONS: { label: string; max: number | null }[] = [
  { label: 'Peu importe', max: null },
  { label: '≤ 1 h 45', max: 105 },
  { label: '≤ 2 h 15', max: 135 },
]

/** Nombre de cartes dans la roulette, et place du film gagnant */
const REEL_LEN = 40
const WIN_AT = 33
const GAP = 12

/** Suite de films pour la roulette : jamais deux fois le même côte à côte (si possible), le gagnant à WIN_AT. */
function buildReel(pool: Film[], winner: Film): Film[] {
  const reel: Film[] = []
  for (let i = 0; i < REEL_LEN; i++) {
    if (i === WIN_AT) {
      reel.push(winner)
      continue
    }
    const prev = reel[i - 1]
    const next = i + 1 === WIN_AT ? winner : null
    const choices = pool.length > 2 ? pool.filter((f) => f.id !== prev?.id && f.id !== next?.id) : pool
    reel.push(choices[Math.floor(Math.random() * choices.length)])
  }
  return reel
}

/**
 * Tirage au sort façon roulette : une bande d'affiches défile sous le repère central,
 * ralentit et s'arrête sur le film choisi. Une seule animation fluide, affiches préchargées.
 */
function DrawOverlay({
  open,
  onClose,
  films,
  categories,
  initialCategory,
}: {
  open: boolean
  onClose: () => void
  films: Film[]
  categories: FilmCategory[]
  initialCategory: string | null
}) {
  const root = useRef<HTMLDivElement>(null)
  useDialog(open, root, onClose)
  const [filter, setFilter] = useState<DrawFilter>({ categoryId: initialCategory, maxRuntime: null })
  const pool = useMemo(() => eligible(films, filter), [films, filter])

  // À chaque ouverture : on repart de la catégorie d'où l'on vient
  useEffect(() => {
    if (open) setFilter({ categoryId: initialCategory, maxRuntime: null })
  }, [open, initialCategory])

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

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={root}
          role="dialog"
          aria-modal
          aria-label="Ce soir on regarde quoi ?"
          tabIndex={-1}
          className="fixed inset-0 z-[65] overflow-hidden bg-night/95 outline-none backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Roulette
            key={`${filter.categoryId}-${filter.maxRuntime}`}
            pool={pool}
            filter={filter}
            setFilter={setFilter}
            categories={categories}
            onClose={onClose}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Roulette({
  pool,
  filter,
  setFilter,
  categories,
  onClose,
}: {
  pool: Film[]
  filter: DrawFilter
  setFilter: (f: DrawFilter | ((f: DrawFilter) => DrawFilter)) => void
  categories: FilmCategory[]
  onClose: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [reel, setReel] = useState<Film[]>(() => (pool.length ? buildReel(pool, draw(pool)!) : []))
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'done'>('idle')
  const x = useMotionValue(0)
  const last = useRef<string | null>(null)
  const winner = phase === 'done' ? reel[WIN_AT] : null

  // Largeur d'une carte selon l'écran
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const card = Math.round(Math.min(Math.max(width * 0.3, 96), 180))
  const step = card + GAP
  const offsetFor = (i: number) => width / 2 - card / 2 - i * step

  // Position de départ (quelques cartes avant le centre) dès que la largeur est connue
  useEffect(() => {
    if (width && phase === 'idle') x.set(offsetFor(2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, card])

  // Précharge les affiches pour qu'aucune carte ne défile vide
  useEffect(() => {
    for (const f of pool) {
      const src = posterUrl(f.poster_path, 'w185')
      if (src) new Image().src = src
    }
  }, [pool])

  const roll = () => {
    if (!pool.length || phase === 'rolling') return
    const pick = draw(pool, last.current)!
    last.current = pick.id
    const next = buildReel(pool, pick)
    // On garde la carte actuellement au centre en première position visible : la relance repart de là
    const startIndex = 2
    if (phase === 'done') next[startIndex] = reel[WIN_AT]
    setReel(next)
    x.set(offsetFor(startIndex))
    setPhase('rolling')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Petit décalage aléatoire pour que l'arrêt ne tombe pas toujours pile au milieu de la carte
    const jitter = (Math.random() - 0.5) * card * 0.5
    animate(x, offsetFor(WIN_AT) + jitter, {
      duration: reduced ? 0.01 : 3.6,
      ease: [0.08, 0.82, 0.17, 1],
    }).then(() => animate(x, offsetFor(WIN_AT), { type: 'spring', damping: 18, stiffness: 220 }).then(() => setPhase('done')))
  }

  const chip = (on: boolean) =>
    `press rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap ${on ? 'border-glow bg-glow/20 text-starlight' : 'border-glow/20 text-mist hover:text-starlight'}`

  return (
    <div className="mx-auto flex h-full max-w-[40rem] flex-col pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3 px-5">
        <h2 className="font-display text-2xl">Ce soir on regarde quoi ?</h2>
        <button
          type="button"
          onClick={onClose}
          className="press -mr-2 rounded-full p-2 text-2xl leading-none text-mist hover:text-starlight"
          aria-label="Fermer"
        >
          ×
        </button>
      </div>

      {/* Filtres : une ligne qui défile pour les catégories, une pour la durée */}
      <div className="mt-3 overflow-x-auto px-5 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] sm:overflow-visible sm:[mask-image:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          <button
            type="button"
            aria-pressed={!filter.categoryId}
            className={chip(!filter.categoryId)}
            disabled={phase === 'rolling'}
            onClick={() => setFilter((f) => ({ ...f, categoryId: null }))}
          >
            Toutes
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={filter.categoryId === c.id}
              className={chip(filter.categoryId === c.id)}
              disabled={phase === 'rolling'}
              onClick={() => setFilter((f) => ({ ...f, categoryId: c.id }))}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 px-5">
        {DURATIONS.map((d) => (
          <button
            key={d.label}
            type="button"
            aria-pressed={filter.maxRuntime === d.max}
            className={chip(filter.maxRuntime === d.max)}
            disabled={phase === 'rolling'}
            onClick={() => setFilter((f) => ({ ...f, maxRuntime: d.max }))}
          >
            {d.label}
          </button>
        ))}
        <span className="self-center pl-1 text-xs text-mist">
          {pool.length} film{pool.length > 1 ? 's' : ''} en lice
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        {/* Roulette */}
        <div
          ref={box}
          className="relative w-full flex-none overflow-hidden py-5 [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]"
        >
          {pool.length ? (
            <>
              <motion.ul className="flex w-max" style={{ x, gap: GAP }} aria-hidden>
                {reel.map((f, i) => (
                  <li key={i} style={{ width: card }} className="flex-none">
                    <motion.div
                      animate={
                        phase === 'done'
                          ? i === WIN_AT
                            ? { scale: 1.08, opacity: 1 }
                            : { scale: 0.94, opacity: 0.35 }
                          : { scale: 1, opacity: 1 }
                      }
                      transition={i === WIN_AT ? SPRING_POP : { duration: 0.4 }}
                    >
                      <Poster
                        film={f}
                        size="w185"
                        eager
                        className={i === WIN_AT && phase === 'done' ? 'shadow-[0_0_40px_rgb(46_91_255/0.7)] ring-2 ring-glow' : ''}
                      />
                    </motion.div>
                  </li>
                ))}
              </motion.ul>
              {/* Repère central : deux petits triangles, et un fil lumineux seulement pendant que ça tourne */}
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-glow to-transparent"
                animate={{ opacity: phase === 'rolling' ? 0.8 : 0 }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 text-xs text-glow drop-shadow-[0_0_6px_#7DA2FF]"
              >
                ▼
              </span>
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-glow drop-shadow-[0_0_6px_#7DA2FF]"
              >
                ▲
              </span>
            </>
          ) : (
            <p className="py-16 text-center text-mist">Aucun film ne correspond à ces filtres.</p>
          )}
        </div>

        {/* Résultat */}
        <div aria-live="polite" className="min-h-[9.5rem] overflow-y-auto px-5 pt-3 text-center">
          {winner ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT }}>
              <p className="text-xs tracking-[0.25em] text-gold uppercase">Ce soir</p>
              <p className="font-display mt-1 text-[clamp(1.6rem,6vw,2.2rem)] leading-tight">{winner.title}</p>
              <p className="mt-1 text-sm text-mist">{[winner.year, formatRuntime(winner.runtime)].filter(Boolean).join(' · ')}</p>
              {winner.overview && (
                <p className="mx-auto mt-3 line-clamp-4 max-w-[32rem] text-sm leading-relaxed text-starlight/85">{winner.overview}</p>
              )}
            </motion.div>
          ) : (
            <p className="pt-2 text-sm text-mist">
              {phase === 'rolling' ? 'Ça tourne…' : 'Choisissez vos envies, puis lancez la roulette.'}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3 px-5 pt-4">
        <button type="button" className="btn-primary min-w-[10rem]" onClick={roll} disabled={!pool.length || phase === 'rolling'}>
          <span aria-hidden>🎲</span> {phase === 'done' ? 'Relancer' : phase === 'rolling' ? 'Ça tourne…' : 'Lancer'}
        </button>
        {winner && (
          <a href={letterboxdUrl(winner)} target="_blank" rel="noreferrer" className="btn-ghost">
            Letterboxd <IconExternal width={15} height={15} />
          </a>
        )}
      </div>
    </div>
  )
}
