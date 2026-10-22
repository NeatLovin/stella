import { useEffect, useState } from 'react'
import { useLoad } from '../hooks/useLoad'
import { api, type Photo } from '../lib/api'
import { formatLong, toISO } from '../lib/dates'
import { compressImage } from '../lib/image'
import { BottomSheet } from './BottomSheet'
import { IconPlus } from './icons'
import { ErrorNote, Loading } from './Page'

/** Légère inclinaison stable par photo, comme des polaroids épinglés. */
function tilt(id: string): number {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return ((Math.abs(h) % 7) - 3) * 0.8
}

export function PhotoWall() {
  const { data, error, loading, reload } = useLoad(api.getPhotos)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState<File | null>(null)
  const [viewing, setViewing] = useState<Photo | null>(null)

  useEffect(() => {
    const paths = (data ?? []).map((p) => p.image_path).filter((p) => !urls[p])
    if (paths.length) void api.imageUrls(paths).then((u) => setUrls((prev) => ({ ...prev, ...u })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return (
    <section aria-labelledby="wall-title" className="mt-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 id="wall-title" className="font-display text-[2.2rem] leading-none font-medium">
          Notre mur
        </h2>
        <label className="btn-ghost cursor-pointer py-2 text-sm">
          <IconPlus width={18} height={18} />
          Ajouter
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
      </div>

      {loading && <Loading />}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <p className="max-w-[36ch] text-mist">Le mur attend sa première photo. Ajoute un moment à nous avec le bouton ci-dessus.</p>
      )}

      {data && data.length > 0 && (
        <ul className="columns-2 gap-4 pb-4">
          {data.map((p) => (
            <li key={p.id} className="mb-5 break-inside-avoid">
              <button
                type="button"
                onClick={() => setViewing(p)}
                className="block w-full bg-starlight p-2 pb-3 text-left shadow-[0_10px_30px_rgb(0_0_0/0.45)] transition-transform active:scale-[0.98]"
                style={{ transform: `rotate(${tilt(p.id)}deg)` }}
                aria-label={p.caption || 'Voir la photo'}
              >
                {urls[p.image_path] ? (
                  <img src={urls[p.image_path]} alt="" loading="lazy" className="block w-full" />
                ) : (
                  <span className="block aspect-[4/5] w-full bg-mist/30" />
                )}
                {p.caption && (
                  <span className="font-display mt-2 block px-1 text-[1.05rem] leading-snug text-night italic">{p.caption}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <BottomSheet open={Boolean(adding)} onClose={() => setAdding(null)} label="Ajouter une photo au mur">
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

      <BottomSheet open={Boolean(viewing)} onClose={() => setViewing(null)} label="Photo">
        {viewing && (
          <ViewPhoto
            photo={viewing}
            src={urls[viewing.image_path]}
            onDeleted={async () => {
              setViewing(null)
              await reload()
            }}
          />
        )}
      </BottomSheet>
    </section>
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
          {busy ? 'Envoi…' : 'Ajouter au mur'}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  )
}

function ViewPhoto({ photo, src, onDeleted }: { photo: Photo; src?: string; onDeleted: () => Promise<void> }) {
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
      {src && <img src={src} alt={photo.caption ?? ''} className="max-h-[60dvh] w-full rounded-xl object-contain" />}
      {photo.caption && <p className="font-display mt-4 text-2xl italic">{photo.caption}</p>}
      <p className="mt-2 text-sm text-mist">Ajoutée le {formatLong(toISO(new Date(photo.created_at)))}</p>
      <div className="mt-5 border-t border-glow/10 pt-4 text-sm">
        {confirm ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-mist">Retirer cette photo du mur ?</span>
            <button type="button" className="rounded-full bg-rose/90 px-4 py-2 font-medium text-night" disabled={busy} onClick={remove}>
              Retirer
            </button>
            <button type="button" className="text-mist underline underline-offset-4" onClick={() => setConfirm(false)}>
              Garder
            </button>
          </div>
        ) : (
          <button type="button" className="text-rose" onClick={() => setConfirm(true)}>
            Retirer du mur
          </button>
        )}
      </div>
    </div>
  )
}
