import { motion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { Lightbox } from '../components/Lightbox'
import { IconExternal } from '../components/icons'
import { ErrorNote, Page, Skeleton } from '../components/Page'
import { useLoad } from '../hooks/useLoad'
import { useImageUrls } from '../hooks/useImageUrls'
import { api, type TimelineEvent } from '../lib/api'
import { diffDays, formatRange, formatShort, todayISO } from '../lib/dates'
import { compressImage } from '../lib/image'
import { parseSpotify, spotifyEmbedUrl, spotifyOpenUrl } from '../lib/spotify'

// Positions horizontales (fraction de la largeur) : une constellation irrégulière mais stable
const XS = [0.22, 0.68, 0.4, 0.78, 0.3, 0.62, 0.2, 0.72, 0.46, 0.8]
const STEP = 132
const TOP = 40

export function Timeline() {
  const { data, error, loading, reload } = useLoad(api.getTimeline)
  const urls = useImageUrls((data ?? []).map((e) => e.image_path))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = data?.find((e) => e.id === selectedId) ?? null

  return (
    <Page title="Notre constellation" intro="Chaque étoile est un moment à nous. Touche-en une pour la revoir.">
      {loading && <Skeleton variant="timeline" />}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {data && data.length === 0 && <p className="text-mist">La constellation attend sa première étoile.</p>}
      {data && data.length > 0 && <Constellation events={data} urls={urls} onSelect={(e) => setSelectedId(e.id)} />}

      <BottomSheet open={Boolean(selected)} onClose={() => setSelectedId(null)} label={selected?.title ?? ''}>
        {selected && <EventDetail event={selected} src={selected.image_path ? urls[selected.image_path] : undefined} onChanged={reload} />}
      </BottomSheet>
    </Page>
  )
}

function Constellation({
  events,
  urls,
  onSelect,
}: {
  events: TimelineEvent[]
  urls: Record<string, string>
  onSelect: (e: TimelineEvent) => void
}) {
  const sorted = [...events].sort((a, b) => a.date_start.localeCompare(b.date_start))
  const points = sorted.map((e, i) => ({ e, x: XS[i % XS.length], y: TOP + i * STEP }))
  const height = TOP * 2 + (sorted.length - 1) * STEP
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [burst, setBurst] = useState<string | null>(null)

  // L'étoile touchée s'illumine, puis sa fiche s'ouvre
  const open = (e: TimelineEvent) => {
    setBurst(e.id)
    window.setTimeout(() => onSelect(e), 220)
    window.setTimeout(() => setBurst(null), 700)
  }

  // Halo qui suit la souris ou le doigt (variables CSS, sans re-rendu)
  const moveHalo = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current
    // À la souris, c'est le halo plein écran (CursorGlow) qui prend le relais
    if (!el || ev.pointerType === 'mouse') return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--hx', `${ev.clientX - r.left}px`)
    el.style.setProperty('--hy', `${ev.clientY - r.top}px`)
    el.dataset.halo = 'on'
  }
  const hideHalo = () => {
    if (ref.current) ref.current.dataset.halo = 'off'
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="relative"
      style={{ height, containerType: 'inline-size' }}
      onPointerMove={moveHalo}
      onPointerDown={moveHalo}
      onPointerLeave={hideHalo}
      onPointerCancel={hideHalo}
    >
      <div className="star-halo pointer-events-none absolute -inset-x-5 inset-y-0" aria-hidden />
      {width > 0 && (
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} aria-hidden>
          {points.slice(1).map((p, i) => {
            const prev = points[i]
            return (
              <motion.line
                key={p.e.id}
                x1={prev.x * width}
                y1={prev.y}
                x2={p.x * width}
                y2={p.y}
                stroke="url(#line)"
                strokeWidth={1}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.25 + i * 0.18, duration: 0.5, ease: 'easeOut' }}
              />
            )
          })}
          <defs>
            <linearGradient id="line" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2={height}>
              <stop offset="0" stopColor="#7DA2FF" stopOpacity="0.7" />
              <stop offset="1" stopColor="#2E5BFF" stopOpacity="0.5" />
            </linearGradient>
          </defs>
        </svg>
      )}

      <ol>
        {points.map(({ e, x, y }, i) => {
          const labelRight = x < 0.5
          return (
            <motion.li
              key={e.id}
              className="absolute"
              style={{ left: `${x * 100}%`, top: y }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.18, duration: 0.45 }}
            >
              <button
                type="button"
                onClick={() => open(e)}
                className={`group absolute top-0 flex -translate-y-1/2 items-center gap-3 ${
                  labelRight ? '-left-[22px] flex-row text-left' : '-right-[22px] flex-row-reverse text-right'
                }`}
              >
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                  <span
                    className={`absolute rounded-full blur-md transition-transform group-active:scale-150 ${
                      e.highlight ? 'h-9 w-9 bg-gold/50' : 'h-7 w-7 bg-glow/45'
                    }`}
                  />
                  <span className={`relative rounded-full ${e.highlight ? 'h-3.5 w-3.5 bg-gold' : 'h-2.5 w-2.5 bg-starlight'}`} />
                  {burst === e.id && (
                    <motion.span
                      className={`absolute h-3 w-3 rounded-full ${e.highlight ? 'bg-gold' : 'bg-glow'}`}
                      initial={{ scale: 1, opacity: 0.9 }}
                      animate={{ scale: 9, opacity: 0 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      aria-hidden
                    />
                  )}
                </span>
                <span
                  className={`flex items-center gap-2.5 ${labelRight ? 'flex-row' : 'flex-row-reverse'}`}
                  style={{ width: `min(15rem, calc(${(labelRight ? 1 - x : x) * 100}cqw - 30px))` }}
                >
                  {e.image_path && (
                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-dusk ring-1 ring-starlight/25" aria-hidden>
                      {urls[e.image_path] && <img src={urls[e.image_path]} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="font-display block text-[1.2rem] leading-[1.1] font-medium text-starlight">
                      <span className="mr-1.5 text-[0.95rem]" aria-hidden>
                        {e.icon}
                      </span>
                      {e.title}
                    </span>
                    <span className="mt-1 block text-xs text-mist/80">
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
                </span>
              </button>
            </motion.li>
          )
        })}
      </ol>
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
              <img src={src} alt={event.title} className="max-h-[48dvh] w-full object-cover" />
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
