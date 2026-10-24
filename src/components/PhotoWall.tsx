import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useLoad } from '../hooks/useLoad'
import { useImageUrls } from '../hooks/useImageUrls'
import { api, type Photo } from '../lib/api'
import { formatLong, toISO } from '../lib/dates'
import { compressImage } from '../lib/image'
import { BottomSheet } from './BottomSheet'
import { Lightbox } from './Lightbox'
import { IconChevron, IconPlus } from './icons'

// Emplacements des photos (en % de la zone), comme étalées sur une table.
// La plus récente prend l'emplacement 0 : au centre, au-dessus des autres.
// Les autres s'écartent autour pour qu'on voie bien chaque photo, avec un léger chevauchement.
type Slot = { top: number; left: number; rotate: number }

// Téléphone : zone étroite à côté du compteur
const COMPACT: Slot[] = [
  { top: 27, left: 20, rotate: -5 },
  { top: 2, left: 2, rotate: -9 },
  { top: 5, left: 40, rotate: 8 },
  { top: 52, left: 0, rotate: 6 },
  { top: 50, left: 40, rotate: -7 },
  { top: 72, left: 20, rotate: 3 },
]
const COMPACT_WIDTH = 'w-[60%]'

// Ordinateur : grande zone, photos plus petites et bien écartées
const SPREAD: Slot[] = [
  { top: 25, left: 27, rotate: -3 },
  { top: 1, left: 2, rotate: -8 },
  { top: 3, left: 52, rotate: 6 },
  { top: 47, left: 1, rotate: 5 },
  { top: 46, left: 53, rotate: -6 },
]
const SPREAD_WIDTH = 'w-[46%]'

/** Polaroids étalés qui se chevauchent légèrement. Remplit son parent (position relative requise). */
export function PhotoWall({ spread = false }: { spread?: boolean }) {
  const SLOTS = spread ? SPREAD : COMPACT
  const { data, reload } = useLoad(api.getPhotos)
  const urls = useImageUrls((data ?? []).map((p) => p.image_path))
  const [adding, setAdding] = useState<File | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [zoom, setZoom] = useState(false)

  const photos = data ?? []
  const pile = photos.slice(0, SLOTS.length)
  const current = viewing !== null ? photos[viewing] : null

  return (
    <div className="absolute inset-0" aria-label="Nos photos">
      {pile.length === 0 && (
        <div
          className="absolute top-[18%] left-[12%] flex aspect-[4/5] w-[78%] -rotate-6 items-center justify-center border-2 border-dashed border-glow/40 p-3 text-center text-xs text-mist lg:text-base"
          aria-hidden
        >
          Votre première photo ici
        </div>
      )}

      {pile
        .map((p, i) => ({ p, i, slot: SLOTS[i] }))
        .reverse() // la plus ancienne dessinée d'abord, la plus récente par-dessus
        .map(({ p, i, slot }) => (
          <motion.button
            key={p.id}
            type="button"
            onClick={() => setViewing(i)}
            className={`absolute ${spread ? SPREAD_WIDTH : COMPACT_WIDTH} bg-starlight p-1.5 pb-4 lg:p-2.5 lg:pb-7 shadow-[0_8px_24px_rgb(0_0_0/0.55)] transition-shadow hover:shadow-[0_14px_40px_rgb(0_0_0/0.65)]`}
            style={{ top: `${slot.top}%`, left: `${slot.left}%`, zIndex: SLOTS.length - i }}
            initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
            animate={{ opacity: 1, scale: 1, rotate: slot.rotate }}
            whileTap={{ scale: 1.06 }}
            whileHover={spread ? { scale: 1.07, rotate: 0, zIndex: 30, transition: { duration: 0.25 } } : undefined}
            transition={{ delay: 0.6 + (pile.length - i) * 0.12, type: 'spring', damping: 16, stiffness: 180 }}
            aria-label={p.caption || 'Voir la photo'}
          >
            {urls[p.image_path] ? (
              <img src={urls[p.image_path]} alt="" className="block aspect-square w-full object-cover" />
            ) : (
              <span className="block aspect-square w-full bg-mist/30" />
            )}
          </motion.button>
        ))}

      <label
        className="absolute right-0 bottom-0 z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-glow/40 bg-night/80 text-glow backdrop-blur"
        aria-label="Ajouter une photo"
      >
        <IconPlus width={20} height={20} />
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) setAdding(f)
            e.target.value = ''
          }}
        />
      </label>

      <BottomSheet open={Boolean(adding)} onClose={() => setAdding(null)} label="Ajouter une photo">
        {adding && (
          <AddPhoto
            file={adding}
            onCancel={() => setAdding(null)}
            onDone={async () => {
              setAdding(null)
              await reload()
            }}
          />
        )}
      </BottomSheet>

      <BottomSheet open={Boolean(current)} onClose={() => setViewing(null)} label="Photo">
        {current && viewing !== null && (
          <ViewPhoto
            key={current.id}
            photo={current}
            src={urls[current.image_path]}
            position={`${viewing + 1} / ${photos.length}`}
            onZoom={() => setZoom(true)}
            onPrev={viewing > 0 ? () => setViewing(viewing - 1) : undefined}
            onNext={viewing < photos.length - 1 ? () => setViewing(viewing + 1) : undefined}
            onDeleted={async () => {
              setViewing(null)
              await reload()
            }}
          />
        )}
      </BottomSheet>

      <Lightbox
        images={photos.map((p) => ({ src: urls[p.image_path], alt: p.caption ?? '' }))}
        index={zoom ? viewing : null}
        onIndexChange={setViewing}
        onClose={() => setZoom(false)}
      />
    </div>
  )
}

function AddPhoto({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: () => Promise<void> }) {
  const [preview, setPreview] = useState<string>()
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const path = await api.uploadImage(await compressImage(file, 1600), 'photos')
      await api.addPhoto(path, caption.trim() || null)
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-3xl font-medium">Nouvelle photo</h2>
      {preview && <img src={preview} alt="Aperçu" className="max-h-[40dvh] w-full rounded-xl object-contain" />}
      <label className="block">
        <span className="mb-1.5 block text-sm text-mist">Légende (facultatif)</span>
        <input
          className="field"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={80}
          placeholder="Un mot sur ce moment"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-rose">
          Envoi impossible : {error}
        </p>
      )}
      <div className="flex gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>
          {busy ? 'Envoi…' : 'Ajouter'}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  )
}

function ViewPhoto({
  photo,
  src,
  position,
  onZoom,
  onPrev,
  onNext,
  onDeleted,
}: {
  photo: Photo
  src?: string
  position: string
  onZoom: () => void
  onPrev?: () => void
  onNext?: () => void
  onDeleted: () => Promise<void>
}) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    setBusy(true)
    try {
      await api.deletePhoto(photo)
      await onDeleted()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {src && (
        <button type="button" onClick={onZoom} className="block w-full" aria-label="Voir la photo en plein écran">
          <img src={src} alt={photo.caption ?? ''} className="max-h-[60dvh] w-full rounded-xl object-contain" />
        </button>
      )}
      <div className="mt-3 flex items-center justify-between text-mist">
        <button
          type="button"
          className="rounded-full p-2 disabled:opacity-25"
          onClick={onPrev}
          disabled={!onPrev}
          aria-label="Photo précédente"
        >
          <IconChevron dir="left" />
        </button>
        <span className="text-sm tabular-nums">{position}</span>
        <button
          type="button"
          className="rounded-full p-2 disabled:opacity-25"
          onClick={onNext}
          disabled={!onNext}
          aria-label="Photo suivante"
        >
          <IconChevron />
        </button>
      </div>
      {photo.caption && <p className="font-display mt-2 text-2xl italic">{photo.caption}</p>}
      <p className="mt-2 text-sm text-mist">Ajoutée le {formatLong(toISO(new Date(photo.created_at)))}</p>
      <div className="mt-5 border-t border-glow/10 pt-4 text-sm">
        {confirm ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-mist">Retirer cette photo ?</span>
            <button type="button" className="rounded-full bg-rose/90 px-4 py-2 font-medium text-night" disabled={busy} onClick={remove}>
              Retirer
            </button>
            <button type="button" className="text-mist underline underline-offset-4" onClick={() => setConfirm(false)}>
              Garder
            </button>
          </div>
        ) : (
          <button type="button" className="text-rose" onClick={() => setConfirm(true)}>
            Retirer la photo
          </button>
        )}
      </div>
    </div>
  )
}
