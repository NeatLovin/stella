import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { Lightbox } from '../components/Lightbox'
import { ErrorNote, Loading, Page } from '../components/Page'
import { useLoad } from '../hooks/useLoad'
import { useImageUrls } from '../hooks/useImageUrls'
import { api, type TimelineEvent } from '../lib/api'
import { diffDays, formatRange, formatShort, todayISO } from '../lib/dates'
import { compressImage } from '../lib/image'

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
      {loading && <Loading />}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {data && data.length === 0 && <p className="text-mist">La constellation attend sa première étoile.</p>}
      {data && data.length > 0 && <Constellation events={data} onSelect={(e) => setSelectedId(e.id)} />}

      <BottomSheet open={Boolean(selected)} onClose={() => setSelectedId(null)} label={selected?.title ?? ''}>
        {selected && <EventDetail event={selected} src={selected.image_path ? urls[selected.image_path] : undefined} onChanged={reload} />}
      </BottomSheet>
    </Page>
  )
}

function Constellation({ events, onSelect }: { events: TimelineEvent[]; onSelect: (e: TimelineEvent) => void }) {
  const sorted = [...events].sort((a, b) => a.date_start.localeCompare(b.date_start))
  const points = sorted.map((e, i) => ({ e, x: XS[i % XS.length], y: TOP + i * STEP }))
  const height = TOP * 2 + (sorted.length - 1) * STEP
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} className="relative" style={{ height, containerType: 'inline-size' }}>
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
                onClick={() => onSelect(e)}
                className={`group absolute top-0 flex -translate-y-1/2 items-center gap-3 ${
                  labelRight ? '-left-[22px] flex-row text-left' : '-right-[22px] flex-row-reverse text-right'
                }`}
                aria-label={`${e.title}, ${formatRange(e.date_start, e.date_end)}`}
              >
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                  <span
                    className={`absolute rounded-full blur-md transition-transform group-active:scale-150 ${
                      e.highlight ? 'h-9 w-9 bg-gold/50' : 'h-7 w-7 bg-glow/45'
                    }`}
                  />
                  <span className={`relative rounded-full ${e.highlight ? 'h-3.5 w-3.5 bg-gold' : 'h-2.5 w-2.5 bg-starlight'}`} />
                </span>
                <span className="leading-tight" style={{ width: `min(14rem, calc(${(labelRight ? 1 - x : x) * 100}cqw - 30px))` }}>
                  <span className="block text-[0.95rem] text-starlight">
                    <span className="mr-1.5">{e.icon}</span>
                    {e.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-mist/80">{formatShort(e.date_start)}</span>
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
      {event.description && <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-starlight/90">{event.description}</p>}
      {ago > 0 && <p className="mt-6 text-sm text-mist">Il y a {ago} jours</p>}

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
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose">
          Envoi impossible : {error}
        </p>
      )}
    </article>
  )
}
