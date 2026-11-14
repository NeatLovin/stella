import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { HeartConstellation } from '../components/HeartConstellation'
import { Lightbox } from '../components/Lightbox'
import { IconExternal } from '../components/icons'
import { ErrorNote, Page, Skeleton } from '../components/Page'
import { useLoad } from '../hooks/useLoad'
import { useImageUrls } from '../hooks/useImageUrls'
import { DESKTOP, useMediaQuery } from '../hooks/useMediaQuery'
import { api, type TimelineEvent } from '../lib/api'
import { diffDays, formatRange, formatShort, todayISO } from '../lib/dates'
import { compressImage } from '../lib/image'
import { EASE_OUT } from '../lib/motion'
import { parseSpotify, spotifyEmbedUrl, spotifyOpenUrl } from '../lib/spotify'

export function Timeline() {
  const { data, error, loading, reload } = useLoad(api.getTimeline, 'timeline')
  const urls = useImageUrls((data ?? []).map((e) => e.image_path))
  const desktop = useMediaQuery(DESKTOP)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const sorted = useMemo(() => [...(data ?? [])].sort((a, b) => a.date_start.localeCompare(b.date_start)), [data])
  // Sur ordinateur, la fiche reste affichée à droite : par défaut, le souvenir le plus récent
  const latest = sorted.at(-1) ?? null
  const selected = sorted.find((e) => e.id === selectedId) ?? (desktop ? latest : null)
  const index = selected ? sorted.findIndex((e) => e.id === selected.id) : -1
  const [dir, setDir] = useState(0)

  // Souvenir précédent (-1) ou suivant (+1), dans l'ordre chronologique
  const goTo = (d: number) => {
    const target = sorted[index + d]
    if (!target) return
    setDir(d)
    setSelectedId(target.id)
  }

  // Flèches du clavier ← →, sauf pendant une saisie
  useEffect(() => {
    if (!selected) return
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]') || ev.altKey || ev.ctrlKey || ev.metaKey) return
      // La photo en plein écran garde ses propres flèches
      if (document.querySelector('[data-lightbox]')) return
      if (ev.key === 'ArrowLeft') goTo(-1)
      else if (ev.key === 'ArrowRight') goTo(1)
      else return
      ev.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const detail = selected && (
    <EventPager
      id={selected.id}
      dir={dir}
      index={index}
      total={sorted.length}
      prev={sorted[index - 1]}
      next={sorted[index + 1]}
      onGo={goTo}
    >
      <EventDetail
        key={selected.id}
        event={selected}
        src={selected.image_path ? urls[selected.image_path] : undefined}
        onChanged={reload}
      />
    </EventPager>
  )

  return (
    <Page
      wide
      eyebrow="Notre histoire"
      title="Notre constellation"
      intro={`Chaque étoile est un moment à nous, et ensemble elles dessinent quelque chose. ${desktop ? 'Clique sur une étoile pour la revoir, puis voyage de l’une à l’autre avec ← →.' : 'Touche une étoile pour la revoir, puis glisse pour passer à la suivante.'}`}
    >
      {loading && <Skeleton variant="timeline" />}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {data && data.length === 0 && <p className="text-mist">La constellation attend sa première étoile.</p>}
      {data && data.length > 0 && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-start lg:gap-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,31rem)] xl:gap-20">
          <div>
            <HeartConstellation events={sorted} urls={urls} activeId={selected?.id ?? null} onSelect={(e) => setSelectedId(e.id)} />
            <MemoryList events={sorted} urls={urls} activeId={selected?.id ?? null} onSelect={(e) => setSelectedId(e.id)} />
          </div>
          {desktop && (
            <aside
              aria-label="Souvenir sélectionné"
              aria-live="polite"
              className="sticky top-10 max-h-[calc(100dvh-var(--tabbar-h)-var(--tabbar-gap)-4rem)] overflow-y-auto rounded-[1.75rem] border border-glow/15 bg-sky/70 p-8 shadow-[0_20px_60px_rgb(0_0_0/0.35)] backdrop-blur-md"
            >
              {detail}
            </aside>
          )}
        </div>
      )}

      {!desktop && (
        <BottomSheet open={Boolean(selected)} onClose={() => setSelectedId(null)} label={selected?.title ?? ''}>
          {detail}
        </BottomSheet>
      )}
    </Page>
  )
}

/** Le fil de nos souvenirs, en liste : lisible d'un coup d'œil, et navigable au clavier */
function MemoryList({
  events,
  urls,
  activeId,
  onSelect,
}: {
  events: TimelineEvent[]
  urls: Record<string, string>
  activeId: string | null
  onSelect: (e: TimelineEvent) => void
}) {
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-xs font-medium tracking-[0.2em] text-gold/90 uppercase">✦ Le fil de notre histoire</h2>
      <ol className="space-y-1.5">
        {events.map((e) => (
          <li key={e.id} data-event={e.id}>
            <button
              type="button"
              onClick={() => onSelect(e)}
              aria-current={activeId === e.id ? 'true' : undefined}
              className={`press flex w-full items-center gap-3 rounded-2xl border px-2.5 py-2 text-left transition-colors ${
                activeId === e.id ? 'border-glow/40 bg-glow/10' : 'border-transparent hover:border-glow/20 hover:bg-starlight/[0.03]'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ${
                  e.highlight ? 'bg-gold/10 ring-gold/40' : 'bg-dusk ring-starlight/15'
                }`}
                aria-hidden
              >
                {e.image_path && urls[e.image_path] ? (
                  <img decoding="async" src={urls[e.image_path]} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg">{e.icon || '✦'}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block truncate text-[1.15rem] leading-tight text-starlight">
                  {e.image_path && e.icon && (
                    <span className="mr-1.5 text-[0.9rem]" aria-hidden>
                      {e.icon}
                    </span>
                  )}
                  {e.title}
                </span>
                <span className="block text-xs text-mist/80">
                  {formatShort(e.date_start)}
                  {e.song_url && (
                    <>
                      <span className="ml-1.5 text-glow" aria-hidden>
                        ♪
                      </span>
                      <span className="sr-only">, avec une chanson</span>
                    </>
                  )}
                </span>
              </span>
              {e.highlight && (
                <span className="text-gold" aria-hidden>
                  ★
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * Passe d'un souvenir à l'autre : boutons Précédent / Suivant collés en bas de la fiche,
 * glissement du doigt vers la gauche ou la droite, et flèches du clavier.
 */
function EventPager({
  id,
  dir,
  index,
  total,
  prev,
  next,
  onGo,
  children,
}: {
  id: string
  dir: number
  index: number
  total: number
  prev?: TimelineEvent
  next?: TimelineEvent
  onGo: (d: number) => void
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)

  // Nouveau souvenir : on remonte en haut de la fiche
  useEffect(() => {
    let el = box.current?.parentElement ?? null
    while (el && !(el.scrollHeight > el.clientHeight && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement
    el?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [id])

  const navButton = (d: -1 | 1, target?: TimelineEvent) => (
    <button
      type="button"
      disabled={!target}
      onClick={() => onGo(d)}
      aria-label={target ? `${d < 0 ? 'Souvenir précédent' : 'Souvenir suivant'} : ${target.title}` : undefined}
      className={`press flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-glow/20 px-3 py-2.5 disabled:pointer-events-none disabled:opacity-30 hover:border-glow/50 ${
        d < 0 ? 'text-left' : 'flex-row-reverse text-right'
      }`}
    >
      <span className="flex-none text-xl leading-none text-glow" aria-hidden>
        {d < 0 ? '‹' : '›'}
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-mist">{d < 0 ? 'Précédent' : 'Suivant'}</span>
        <span className="block truncate text-sm">{target ? target.title : '—'}</span>
      </span>
    </button>
  )

  return (
    <div ref={box}>
      <div className="overflow-x-clip">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={id}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 48 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -48 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.24, ease: EASE_OUT }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: next ? 0.35 : 0.08, right: prev ? 0.35 : 0.08 }}
            dragDirectionLock
            onDragEnd={(_, info) => {
              if ((info.offset.x < -70 || info.velocity.x < -500) && next) onGo(1)
              else if ((info.offset.x > 70 || info.velocity.x > 500) && prev) onGo(-1)
            }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav
        aria-label="Passer d’un souvenir à l’autre"
        className="sticky bottom-0 z-10 -mx-2 mt-4 flex items-center gap-2 bg-gradient-to-t from-sky from-70% to-transparent px-2 pt-6 pb-1"
      >
        {navButton(-1, prev)}
        <span className="flex-none px-1 text-xs text-mist tabular-nums" aria-live="polite">
          {index + 1} / {total}
        </span>
        {navButton(1, next)}
      </nav>
    </div>
  )
}

function EventDetail({ event, src, onChanged }: { event: TimelineEvent; src?: string; onChanged: () => Promise<void> }) {
  const ago = diffDays(todayISO(), event.date_start)
  const [zoom, setZoom] = useState(false)
  const [editingSong, setEditingSong] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const replacePhoto = async (file: File | null) => {
    setBusy(true)
    setError(null)
    try {
      const path = file ? await api.uploadImage(await compressImage(file), 'timeline') : null
      await api.setEventImage(event.id, path)
      if (event.image_path) await api.deleteImage(event.image_path)
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="pb-2">
      {event.image_path ? (
        <div className="-mx-2 mb-5 overflow-hidden rounded-[1.25rem] border border-glow/15 bg-dusk/60">
          {src ? (
            <button type="button" onClick={() => setZoom(true)} className="relative block w-full" aria-label="Voir la photo en plein écran">
              <img decoding="async" src={src} alt={event.title} className="max-h-[48dvh] w-full object-cover" />
              <span
                className="absolute right-2 bottom-2 rounded-full bg-night/70 px-2.5 py-1 text-xs text-starlight backdrop-blur"
                aria-hidden
              >
                ⤢ Agrandir
              </span>
            </button>
          ) : (
            <div className="aspect-[4/3]" />
          )}
          <Lightbox images={[{ src, alt: event.title }]} index={zoom ? 0 : null} onClose={() => setZoom(false)} />
        </div>
      ) : (
        <div className="text-5xl" aria-hidden>
          {event.icon}
        </div>
      )}
      <p className="mt-4 text-sm text-glow">{formatRange(event.date_start, event.date_end)}</p>
      <h2 className="font-display mt-1 text-[2rem] leading-tight font-medium">{event.title}</h2>
      {event.description && (
        <div className="mt-4 max-w-[52ch] space-y-3 text-lg leading-relaxed text-starlight/90">
          {event.description
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
        </div>
      )}
      {ago > 0 && <p className="mt-6 text-sm text-mist">Il y a {ago} jours</p>}

      <SongPlayer url={event.song_url} title={event.title} />

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-glow/10 pt-4 text-sm">
        <label className={`cursor-pointer text-glow ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          {busy ? 'Envoi…' : event.image_path ? 'Changer la photo' : 'Ajouter une photo'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void replacePhoto(f)
              e.target.value = ''
            }}
          />
        </label>
        {event.image_path && (
          <button type="button" className="text-mist" disabled={busy} onClick={() => void replacePhoto(null)}>
            Retirer la photo
          </button>
        )}
        <button type="button" className="text-glow" disabled={busy} onClick={() => setEditingSong((v) => !v)} aria-expanded={editingSong}>
          {event.song_url ? 'Changer la chanson' : 'Ajouter une chanson'}
        </button>
      </div>
      {editingSong && (
        <SongEditor
          current={event.song_url}
          onCancel={() => setEditingSong(false)}
          onSave={async (url) => {
            await api.setEventSong(event.id, url)
            setEditingSong(false)
            await onChanged()
          }}
        />
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose">
          Envoi impossible : {error}
        </p>
      )}
    </article>
  )
}

/** Lecteur Spotify intégré : écoute complète si Sarah est connectée à son compte, sinon extrait de 30 s. */
function SongPlayer({ url, title }: { url: string | null; title: string }) {
  const ref = parseSpotify(url)
  const [loaded, setLoaded] = useState(false)
  if (!ref) return null
  const tall = ref.kind !== 'track' && ref.kind !== 'episode'
  return (
    <section aria-label="Notre chanson" className="mt-6">
      <div className={`relative overflow-hidden rounded-[0.9rem] bg-dusk/70 ${tall ? 'h-[352px]' : 'h-[152px]'}`}>
        {!loaded && <span className="shimmer absolute inset-0" aria-hidden />}
        <iframe
          title={`Chanson du souvenir « ${title} » sur Spotify`}
          src={spotifyEmbedUrl(ref)}
          width="100%"
          height="100%"
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className={`relative block border-0 [color-scheme:light] transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
        />
      </div>
      <a
        href={spotifyOpenUrl(ref)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 py-1 text-sm text-mist hover:text-starlight"
      >
        Ouvrir dans Spotify
        <IconExternal width={14} height={14} />
      </a>
    </section>
  )
}

function SongEditor({
  current,
  onCancel,
  onSave,
}: {
  current: string | null
  onCancel: () => void
  onSave: (url: string | null) => Promise<void>
}) {
  const [value, setValue] = useState(current ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (url: string | null) => {
    setBusy(true)
    setError(null)
    try {
      await onSave(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const ref = parseSpotify(value)
    if (!ref) {
      setError('Ce lien n’est pas reconnu. Dans Spotify : ⋯ → Partager → Copier le lien du titre.')
      return
    }
    void save(spotifyOpenUrl(ref))
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm text-mist">Lien Spotify (titre, album ou playlist)</span>
        <input
          className="field"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://open.spotify.com/track/…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'song-error' : undefined}
        />
      </label>
      {error && (
        <p id="song-error" role="alert" className="text-sm text-rose">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy || !value.trim()}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>
          Annuler
        </button>
        {current && (
          <button type="button" className="text-sm text-rose" disabled={busy} onClick={() => void save(null)}>
            Retirer la chanson
          </button>
        )}
      </div>
    </form>
  )
}
