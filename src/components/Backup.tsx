import { motion } from 'motion/react'
import { useState } from 'react'
import { api } from '../lib/api'
import { todayISO } from '../lib/dates'
import { BottomSheet } from './BottomSheet'

// Sauvegarde complète : toutes les tables en JSON et tous les fichiers du stockage, dans un seul .zip.

const TABLES = [
  'settings',
  'timeline_events',
  'reasons',
  'wishlist_items',
  'photos',
  'milestone_messages',
  'periods',
  'ovulations',
  'symptoms',
  'film_categories',
  'films',
  'advent_days',
  'advent_state',
] as const

type Step =
  | { phase: 'idle' }
  | { phase: 'data' }
  | { phase: 'files'; done: number; total: number }
  | { phase: 'zip' }
  | { phase: 'done'; size: number; files: number; failed: string[] }
  | { phase: 'error'; message: string }

const README = (date: string, missing: string[], failed: string[]) => `Sauvegarde de Stella du ${date}

Contenu
- data/tout.json : toutes les tables dans un seul fichier
- data/<table>.json : une table par fichier
- fichiers/ : toutes les photos et fichiers du stockage privé, avec leurs chemins d'origine
  (les tables y font référence par ce chemin, par exemple « timeline/abc.jpg »)

Restaurer
- Données : réinsérer les lignes de chaque table (SQL Editor de Supabase, ou en demandant à Claude)
- Fichiers : les renvoyer dans Storage > bucket « wishlist » en gardant les mêmes dossiers

Attention : ce fichier contient tout, y compris les données du cycle et la clé TMDB.
À garder en lieu sûr, jamais dans le dépôt GitHub (public).
${missing.length ? `\nTables absentes au moment de la sauvegarde : ${missing.join(', ')}\n` : ''}${failed.length ? `\nFichiers qui n'ont pas pu être téléchargés : ${failed.join(', ')}\n` : ''}`

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 10 * 1024 * 1024 ? 0 : 1)} Mo`

export function BackupButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-10 self-start text-xs tracking-wide text-mist/60 underline-offset-4 hover:text-mist hover:underline"
      >
        ⤓ Sauvegarde
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} label="Sauvegarde">
        {open && <BackupPanel />}
      </BottomSheet>
    </>
  )
}

function BackupPanel() {
  const [step, setStep] = useState<Step>({ phase: 'idle' })
  const busy = step.phase === 'data' || step.phase === 'files' || step.phase === 'zip'

  const run = async () => {
    try {
      setStep({ phase: 'data' })
      const date = todayISO()
      const { data, missing } = await api.exportTables(TABLES)

      const paths = await api.listFiles()
      const files: Record<string, Uint8Array> = {}
      const failed: string[] = []
      let done = 0
      setStep({ phase: 'files', done, total: paths.length })
      // Quatre téléchargements à la fois
      const queue = [...paths]
      const worker = async () => {
        while (queue.length) {
          const p = queue.shift()!
          try {
            files[`fichiers/${p}`] = new Uint8Array(await (await api.downloadFile(p)).arrayBuffer())
          } catch {
            failed.push(p)
          }
          done++
          setStep({ phase: 'files', done, total: paths.length })
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()])

      setStep({ phase: 'zip' })
      const { strToU8, zip } = await import('fflate')
      const entries: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
        'LISEZMOI.txt': strToU8(README(date, missing, failed)),
        'data/tout.json': strToU8(JSON.stringify({ exporte_le: new Date().toISOString(), ...data }, null, 2)),
      }
      for (const [t, rows] of Object.entries(data)) entries[`data/${t}.json`] = strToU8(JSON.stringify(rows, null, 2))
      // Les photos sont déjà compressées : on les range sans les recompresser (plus rapide)
      for (const [p, bytes] of Object.entries(files)) entries[p] = [bytes, { level: 0 }]

      const out = await new Promise<Uint8Array>((resolve, reject) =>
        zip(entries, { level: 6 }, (err, res) => (err ? reject(err) : resolve(res))),
      )
      const blob = new Blob([out as BlobPart], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stella-sauvegarde-${date}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setStep({ phase: 'done', size: blob.size, files: paths.length - failed.length, failed })
    } catch (e) {
      setStep({ phase: 'error', message: e instanceof Error ? e.message : 'La sauvegarde a échoué' })
    }
  }

  const progress =
    step.phase === 'files' && step.total ? step.done / step.total : step.phase === 'zip' ? 1 : step.phase === 'data' ? 0.05 : 0

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-3xl">Sauvegarde</h2>
        <p className="mt-2 text-mist">
          Télécharge tout Stella dans un seul fichier .zip : souvenirs, raisons, wishlist, cycle, films, calendrier, réglages, et toutes les
          photos.
        </p>
      </div>

      {busy && (
        <div className="space-y-2" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-starlight/10">
            <motion.div
              className="h-full rounded-full bg-glow"
              animate={{ width: `${Math.max(4, progress * 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-sm text-mist">
            {step.phase === 'data' && 'Récupération des données…'}
            {step.phase === 'files' && `Photos et fichiers : ${step.done} / ${step.total}`}
            {step.phase === 'zip' && 'Création du fichier .zip…'}
          </p>
        </div>
      )}

      {step.phase === 'done' && (
        <p className="rounded-2xl border border-glow/25 bg-glow/5 px-4 py-3 text-sm" role="status">
          C’est prêt ✓ {mb(step.size)}, avec {step.files} fichier{step.files > 1 ? 's' : ''}. Le téléchargement a démarré.
          {step.failed.length > 0 && ` ${step.failed.length} fichier(s) n’ont pas pu être récupérés (la liste est dans LISEZMOI.txt).`}
        </p>
      )}
      {step.phase === 'error' && (
        <p className="text-sm text-rose" role="alert">
          {step.message}
        </p>
      )}

      <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => void run()}>
        {busy ? 'Sauvegarde en cours…' : step.phase === 'done' ? 'Télécharger à nouveau' : '⤓ Tout télécharger'}
      </button>
      <p className="text-xs leading-relaxed text-mist/80">
        Le fichier contient tout, y compris les données du cycle et la clé TMDB : garde-le en lieu sûr. Sur iPhone, il arrive dans l’app
        Fichiers.
      </p>
    </div>
  )
}
