import { useEffect, useState, type FormEvent } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { IconExternal, IconGift, IconImage, IconPlus } from '../components/icons'
import { ErrorNote, Page, Skeleton } from '../components/Page'
import { useLoad } from '../hooks/useLoad'
import { useImageUrls } from '../hooks/useImageUrls'
import { api, type WishlistItem } from '../lib/api'
import { compressImage } from '../lib/image'

type Editing = { mode: 'new' } | { mode: 'edit'; item: WishlistItem }

export function Wishlist() {
  const { data, error, loading, reload } = useLoad(api.getWishlist)
  const urls = useImageUrls((data ?? []).map((w) => w.image_path))
  const [editing, setEditing] = useState<Editing | null>(null)

  const close = () => setEditing(null)
  const saved = async () => {
    close()
    await reload()
  }

  return (
    <Page title="Wishlist" intro="Tout ce qui te fait envie, au même endroit.">
      <button type="button" className="btn-primary mb-8" onClick={() => setEditing({ mode: 'new' })}>
        <IconPlus width={20} height={20} />
        Ajouter une envie
      </button>

      {loading && <Skeleton variant="cards" />}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {data && data.length === 0 && <p className="text-mist">Ta wishlist est vide. Ajoute ta première envie avec le bouton ci-dessus.</p>}

      {data && data.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-7">
          {data.map((item) => (
            <li key={item.id}>
              <WishCard
                item={item}
                src={item.image_path ? urls[item.image_path] : undefined}
                onEdit={() => setEditing({ mode: 'edit', item })}
              />
            </li>
          ))}
        </ul>
      )}

      <BottomSheet open={Boolean(editing)} onClose={close} label={editing?.mode === 'edit' ? 'Modifier l’envie' : 'Nouvelle envie'}>
        {editing && (
          <WishForm
            key={editing.mode === 'edit' ? editing.item.id : 'new'}
            item={editing.mode === 'edit' ? editing.item : undefined}
            currentSrc={editing.mode === 'edit' && editing.item.image_path ? urls[editing.item.image_path] : undefined}
            onDone={saved}
            onCancel={close}
          />
        )}
      </BottomSheet>
    </Page>
  )
}

function WishCard({ item, src, onEdit }: { item: WishlistItem; src?: string; onEdit: () => void }) {
  return (
    <article className="group">
      <button type="button" onClick={onEdit} className="block w-full text-left" aria-label={`Modifier ${item.name}`}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.1rem] border border-glow/15 bg-dusk/60">
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgb(46_91_255/0.35),transparent_70%)] text-glow/80">
              <IconGift width={40} height={40} />
            </div>
          )}
        </div>
        <h2 className="mt-3 line-clamp-2 leading-snug">{item.name}</h2>
      </button>
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 py-1 text-sm text-glow"
        >
          Voir le lien
          <IconExternal width={14} height={14} />
        </a>
      )}
    </article>
  )
}

function normalizeUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

function WishForm({
  item,
  currentSrc,
  onDone,
  onCancel,
}: {
  item?: WishlistItem
  currentSrc?: string
  onDone: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [url, setUrl] = useState(item?.url ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | undefined>(currentSrc)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!file) return
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      let image_path = removePhoto ? null : (item?.image_path ?? null)
      if (file) image_path = await api.uploadImage(await compressImage(file))
      const input = { name: name.trim(), url: normalizeUrl(url), image_path }
      if (item) {
        await api.updateWish(item.id, input)
        if (item.image_path && item.image_path !== image_path) await api.deleteImage(item.image_path)
      } else {
        await api.addWish(input)
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!item) return
    setBusy(true)
    try {
      await api.deleteWish(item)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h2 className="font-display text-3xl font-medium">{item ? 'Modifier l’envie' : 'Nouvelle envie'}</h2>

      <label className="block">
        <span className="mb-1.5 block text-sm text-mist">Nom</span>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          placeholder="Ce qui te fait envie"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm text-mist">Lien (facultatif)</span>
        <input
          className="field"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </label>

      <div>
        <span className="mb-1.5 block text-sm text-mist">Photo (facultatif)</span>
        <div className="flex items-center gap-4">
          <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-glow/20 bg-dusk/60">
            {preview && !removePhoto ? (
              <img src={preview} alt="Aperçu" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-mist/60">
                <IconImage />
              </div>
            )}
          </div>
          <div className="flex flex-col items-start gap-2">
            <label className="btn-ghost cursor-pointer">
              {preview && !removePhoto ? 'Changer la photo' : 'Choisir une photo'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setFile(f)
                    setRemovePhoto(false)
                  }
                }}
              />
            </label>
            {preview && !removePhoto && (
              <button
                type="button"
                className="text-sm text-mist underline underline-offset-4"
                onClick={() => {
                  setFile(null)
                  setRemovePhoto(true)
                }}
              >
                Retirer la photo
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose">
          Enregistrement impossible : {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
          {busy ? 'Enregistrement…' : item ? 'Enregistrer' : 'Ajouter'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          Annuler
        </button>
      </div>

      {item && (
        <div className="border-t border-glow/10 pt-4">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-mist">Supprimer « {item.name} » ?</span>
              <button
                type="button"
                className="rounded-full bg-rose/90 px-4 py-2 text-sm font-medium text-night"
                onClick={remove}
                disabled={busy}
              >
                Supprimer
              </button>
              <button type="button" className="text-sm text-mist underline underline-offset-4" onClick={() => setConfirmDelete(false)}>
                Garder
              </button>
            </div>
          ) : (
            <button type="button" className="text-sm text-rose" onClick={() => setConfirmDelete(true)}>
              Supprimer cette envie
            </button>
          )}
        </div>
      )}
    </form>
  )
}
