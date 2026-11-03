import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '../context'
import { useDialog } from '../hooks/useDialog'

// Lys caché : une fleur faite de caractères qui éclot, puis une carte à ouvrir.
// Les images de l'éclosion sont des pages de texte (un caractère + une intensité 0-7 par case).

interface LilyData {
  cols: number
  rows: number
  fps: number
  frames: [string, string][]
}

// Du bleu nuit au blanc bleuté (intensités 1 à 7)
const LEVELS = ['', '#12206a', '#2448e0', '#3563ff', '#5b86ff', '#8eacff', '#c3d3ff', '#eef2ff']
const CELL_RATIO = 14 / 8 // hauteur d'une case / largeur

let cache: Promise<LilyData> | null = null
const loadLily = () =>
  (cache ??= fetch(`${import.meta.env.BASE_URL}lys.json`).then((r) => {
    if (!r.ok) throw new Error('Fleur introuvable')
    return r.json() as Promise<LilyData>
  }))

const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function LilyEgg({ open, onClose }: { open: boolean; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  useDialog(open, root, onClose)

  useEffect(() => {
    if (!open) return
    document.body.dataset.playing = '1'
    // La page derrière ne défile plus : un seul écran, sans barre de défilement en double
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
          tabIndex={-1}
          role="dialog"
          aria-modal
          aria-label="Un lys pour toi"
          className="fixed inset-0 z-[65] overflow-hidden bg-night outline-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Bloom onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Bloom({ onClose }: { onClose: () => void }) {
  const { her_name, flower_message } = useSettings()
  const canvas = useRef<HTMLCanvasElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<LilyData | null>(null)
  const [failed, setFailed] = useState(false)
  const [done, setDone] = useState(false)
  const [run, setRun] = useState(0) // relancer l'éclosion
  const [card, setCard] = useState(false)

  useEffect(() => {
    loadLily()
      .then(setData)
      .catch(() => setFailed(true))
  }, [])

  useEffect(() => {
    if (!data || !canvas.current) return
    const cv = canvas.current
    const ctx = cv.getContext('2d')!
    let raf = 0
    let start = 0

    let cur = 0
    // La fleur prend la plus grande taille qui tient dans l'espace libre (largeur et hauteur)
    const layout = () => {
      const box = area.current!
      const cell = Math.max(1, Math.min(box.clientWidth / data.cols, box.clientHeight / (data.rows * CELL_RATIO)))
      const w = cell * data.cols
      const h = cell * CELL_RATIO * data.rows
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      cv.style.width = `${w}px`
      cv.style.height = `${h}px`
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // taille de police qui fait tomber chaque caractère exactement dans sa case
      ctx.font = '100px ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace'
      const advance = ctx.measureText('M').width / 100
      return { cell, size: cell / advance }
    }
    let geo = layout()

    const draw = (i: number) => {
      cur = i
      const [chars, levels] = data.frames[i]
      const rowH = geo.cell * CELL_RATIO
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.textBaseline = 'top'
      for (let lv = 1; lv <= 7; lv++) {
        ctx.font = `${lv >= 6 ? 'bold ' : ''}${geo.size}px ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace`
        ctx.fillStyle = LEVELS[lv]
        const code = String(lv)
        for (let r = 0; r < data.rows; r++) {
          let line = ''
          let any = false
          for (let c = 0; c < data.cols; c++) {
            const k = r * data.cols + c
            if (levels[k] === code) {
              line += chars[k]
              any = true
            } else line += ' '
          }
          if (any) ctx.fillText(line, 0, r * rowH)
        }
      }
    }

    const last = data.frames.length - 1
    setDone(false)
    if (prefersReduced()) {
      draw(last)
      setDone(true)
    } else {
      const loop = (t: number) => {
        if (!start) start = t
        const i = Math.min(last, Math.floor(((t - start) / 1000) * data.fps))
        draw(i)
        if (i < last) raf = requestAnimationFrame(loop)
        else setDone(true)
      }
      raf = requestAnimationFrame(loop)
    }

    // Redessine à la bonne taille quand l'écran tourne ou quand la carte s'ouvre
    const observer = new ResizeObserver(() => {
      geo = layout()
      draw(cur)
    })
    observer.observe(area.current!)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [data, run])

  const paragraphs = flower_message.split(/\n\s*\n/).filter(Boolean)

  return (
    <div className="flex h-full flex-col items-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full flex-none items-center justify-between">
        {done ? (
          <button
            type="button"
            onClick={() => {
              setCard(false)
              setRun((r) => r + 1)
            }}
            className="py-2 text-sm text-mist hover:text-starlight"
          >
            Refaire éclore
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-starlight backdrop-blur"
        >
          ×
        </button>
      </div>

      <div ref={area} className="relative flex min-h-0 w-full max-w-[40rem] flex-1 items-center justify-center">
        <canvas ref={canvas} role="img" aria-label="Un lys blanc, dessiné avec des lettres, qui s’ouvre" className="lily-glow block" />
        {!data && !failed && <p className="absolute text-mist">…</p>}
        {failed && <p className="absolute px-6 text-center text-mist">La fleur n’a pas pu s’ouvrir. Réessaie avec du réseau.</p>}
      </div>

      <AnimatePresence>
        {done && paragraphs.length > 0 && (
          <motion.div
            className="mt-3 w-full max-w-[34rem] flex-none"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {!card ? (
              <button
                type="button"
                onClick={() => setCard(true)}
                className="glass mx-auto flex items-center gap-3 rounded-2xl px-6 py-4 font-display text-2xl italic shadow-[0_0_40px_rgba(46,91,255,.25)]"
              >
                Pour {her_name || 'toi'} <span className="text-glow not-italic">✦</span>
              </button>
            ) : (
              <div className="glass max-h-[62dvh] overflow-y-auto rounded-3xl px-5 py-4 lg:px-8 lg:py-6">
                <TypedMessage paragraphs={paragraphs} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Le message s'écrit lettre par lettre (affiché d'un coup si les animations sont réduites). */
function TypedMessage({ paragraphs }: { paragraphs: string[] }) {
  const full = paragraphs.join('\n\n')
  const [n, setN] = useState(() => (prefersReduced() ? full.length : 0))

  useEffect(() => {
    if (n >= full.length) return
    const ch = full[n - 1]
    const delay = ch === '\n' ? 380 : ch === '.' || ch === ',' || ch === ':' ? 220 : 32
    const id = window.setTimeout(() => setN((x) => x + 1), delay)
    return () => clearTimeout(id)
  }, [n, full])

  const shown = full.slice(0, n).split('\n\n')
  return (
    <div className="font-display space-y-[0.6em] text-[clamp(0.98rem,0.45rem+1.45vh,1.32rem)] leading-snug">
      {/* Texte complet pour les lecteurs d'écran, la version animée est décorative */}
      <p className="sr-only">{full}</p>
      <div aria-hidden className="space-y-[0.6em]">
        {shown.map((p, i) => (
          <p key={i}>
            {p}
            {i === shown.length - 1 && n < full.length && <span className="ml-0.5 inline-block w-[0.5ch] animate-pulse text-glow">▍</span>}
          </p>
        ))}
      </div>
      {n < full.length && (
        <button type="button" onClick={() => setN(full.length)} className="font-sans text-sm text-mist hover:text-starlight">
          Tout afficher
        </button>
      )}
    </div>
  )
}
