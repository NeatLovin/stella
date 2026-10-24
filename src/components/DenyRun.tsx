import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useDialog } from '../hooks/useDialog'
import { createGame, type Game, type Status } from '../lib/denyRun'

const BEST_KEY = 'stella.deny.best'

export function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}
function writeBest(n: number) {
  try {
    localStorage.setItem(BEST_KEY, String(n))
  } catch {
    /* stockage indisponible : le record n'est pas gardé */
  }
}

/** Mini-jeu plein écran : Deny court, on touche l'écran (ou Espace) pour sauter. */
export function DenyRun({ open, onClose }: { open: boolean; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  useDialog(open, root, onClose)

  // Pendant le jeu : pas de pop-up d'eau, et le ciel du site arrête de se redessiner
  useEffect(() => {
    if (!open) return
    document.body.dataset.playing = '1'
    return () => {
      delete document.body.dataset.playing
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
          aria-label="Deny, le mini-jeu"
          className="fixed inset-0 z-[65] flex flex-col bg-night outline-none select-none [-webkit-touch-callout:none]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Play onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Play({ onClose }: { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const game = useRef<Game | null>(null)
  const [status, setStatus] = useState<Status>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(readBest)
  const [record, setRecord] = useState(false)

  useEffect(() => {
    const g = createGame(canvas.current!, (s, points) => {
      setStatus(s)
      if (s !== 'over') return
      setScore(points)
      const previous = readBest()
      setRecord(points > previous)
      if (points > previous) {
        writeBest(points)
        setBest(points)
      }
    })
    game.current = g

    const isJumpKey = (e: KeyboardEvent) => e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' '
    const down = (e: KeyboardEvent) => {
      if (!isJumpKey(e)) return
      e.preventDefault()
      if (!e.repeat) g.press()
    }
    const up = (e: KeyboardEvent) => {
      if (!isJumpKey(e)) return
      e.preventDefault()
      g.release()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', g.pause)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', g.pause)
      g.destroy()
    }
  }, [])

  // Toucher n'importe où (hors boutons) pour sauter
  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    game.current?.press()
  }
  const onPointerUp = () => game.current?.release()

  return (
    <div
      className="relative flex flex-1 touch-none flex-col md:items-center md:justify-center md:px-8"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2 md:absolute md:inset-x-0 md:top-0">
        <div>
          <h2 className="font-display text-3xl font-medium">Deny</h2>
          <p className="text-sm text-mist tabular-nums">Record : {best}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le jeu"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-starlight backdrop-blur"
        >
          ×
        </button>
      </header>

      <div className="relative min-h-0 w-full flex-1 md:max-w-5xl md:flex-none">
        <canvas
          ref={canvas}
          role="img"
          aria-label="Deny le suricate court dans le désert, sous les étoiles"
          className="absolute inset-0 block h-full w-full md:static md:h-[clamp(15rem,46dvh,24rem)] md:rounded-3xl md:border md:border-glow/20 md:shadow-[0_0_60px_rgba(46,91,255,.18)]"
        />

        <div aria-live="polite" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {status === 'ready' && (
            <p className="glass rounded-full px-5 py-2.5 text-sm text-starlight">
              <span className="pointer-coarse:hidden">Espace pour sauter</span>
              <span className="hidden pointer-coarse:inline">Touche l’écran pour sauter</span>
            </p>
          )}
          {status === 'paused' && <p className="glass rounded-full px-5 py-2.5 text-sm text-starlight">Pause · touche pour reprendre</p>}
          {status === 'over' && (
            <motion.div
              className="glass pointer-events-auto rounded-3xl px-7 py-5"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
            >
              <p className="font-display text-2xl">{record ? 'Nouveau record ✨' : 'Aïe, Deny est tombé'}</p>
              <p className="mt-1 text-sm text-mist tabular-nums">
                Score : {score}
                {!record && ` · Record : ${best}`}
              </p>
              <button
                type="button"
                onClick={() => game.current?.restart()}
                className="mt-4 rounded-full bg-electric px-6 py-2.5 text-sm font-medium text-white shadow-[0_0_24px_rgba(46,91,255,.45)]"
              >
                Rejouer
              </button>
            </motion.div>
          )}
        </div>
      </div>

      <p className="flex h-[14dvh] items-end justify-center bg-[#0c1440] pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs text-mist/80 md:absolute md:inset-x-0 md:bottom-0 md:h-auto md:bg-transparent">
        Maintiens pour sauter plus haut
      </p>
    </div>
  )
}
